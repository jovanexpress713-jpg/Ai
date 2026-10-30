import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { getDb, User, UserRole } from './db.ts';
import { isProductionAuthConfigured, shouldUseDevelopmentFallback } from './auth-policy.ts';

const SESSION_COOKIE = 'forgex_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map<string, { user: User; createdAt: number; lastSeenAt: number }>();
const loginAttempts = new Map<string, { count: number; firstAt: number; blockedUntil: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;

export function getAuthenticatedUser(req: Request): User | null {
  return (req as Request & { forgexUser?: User }).forgexUser || null;
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie || '';
  return Object.fromEntries(header.split(';').map((part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return ['', ''];
    try { return [part.slice(0, idx).trim(), decodeURIComponent(part.slice(idx + 1).trim())]; }
    catch { return ['', '']; }
  }).filter(([k]) => k));
}

function setSessionCookie(res: Response, token: string, clear = false): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const maxAge = clear ? 0 : SESSION_TTL_MS / 1000;
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}${secure}`);
}

function clientKey(req: Request): string {
  return String(req.ip || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
}

function isRateLimited(key: string): boolean {
  const item = loginAttempts.get(key);
  if (!item) return false;
  if (item.blockedUntil > Date.now()) return true;
  if (Date.now() - item.firstAt > WINDOW_MS) loginAttempts.delete(key);
  return false;
}

function recordFailedLogin(key: string): void {
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || now - current.firstAt > WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
    return;
  }
  current.count += 1;
  if (current.count >= MAX_ATTEMPTS) current.blockedUntil = now + BLOCK_MS;
}

function clearFailedLogins(key: string): void { loginAttempts.delete(key); }

function newSession(user: User): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  sessions.set(token, { user: { ...user }, createdAt: now, lastSeenAt: now });
  return token;
}

function cleanupSessions(): void {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [token, item] of sessions) if (item.lastSeenAt < cutoff) sessions.delete(token);
}

function requireConfiguredProductionAuth(res: Response): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  if (isProductionAuthConfigured()) return true;
  res.status(503).json({
    success: false,
    error: 'Production authentication is not configured. Set FORGEX_ADMIN_EMAIL and a FORGEX_ADMIN_PASSWORD of at least 16 characters.',
  });
  return false;
}

export function login(req: Request, res: Response): void {
  const key = clientKey(req);
  if (isRateLimited(key)) {
    res.status(429).json({ success: false, error: 'Too many login attempts. Please try again later.' });
    return;
  }

  if (!requireConfiguredProductionAuth(res)) return;

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const db = getDb();
  const configuredEmail = String(process.env.FORGEX_ADMIN_EMAIL || '').trim().toLowerCase();
  const configuredPassword = process.env.FORGEX_ADMIN_PASSWORD || '';

  if (shouldUseDevelopmentFallback()) {
    clearFailedLogins(key);
    cleanupSessions();
    const user: User = { ...db.currentUser, email: email || db.currentUser.email, role: 'Owner' };
    const token = newSession(user);
    setSessionCookie(res, token);
    res.json({ success: true, user });
    return;
  }

  const a = Buffer.from(password);
  const b = Buffer.from(configuredPassword);
  const passwordOk = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (email !== configuredEmail || !passwordOk) {
    recordFailedLogin(key);
    res.status(401).json({ success: false, error: 'Invalid credentials.' });
    return;
  }

  clearFailedLogins(key);
  cleanupSessions();
  const user: User = { ...db.currentUser, email: configuredEmail, role: 'Owner' };
  const token = newSession(user);
  setSessionCookie(res, token);
  res.json({ success: true, user });
}

export function session(req: Request, res: Response): void {
  cleanupSessions();
  if (!requireConfiguredProductionAuth(res)) return;

  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) {
    if (shouldUseDevelopmentFallback()) {
      const db = getDb();
      const user: User = { ...db.currentUser };
      const devToken = newSession(user);
      setSessionCookie(res, devToken);
      res.json({ success: true, authenticated: true, user });
      return;
    }
    res.status(401).json({ success: false, authenticated: false });
    return;
  }
  const active = sessions.get(token);
  if (!active || Date.now() - active.lastSeenAt > SESSION_TTL_MS) {
    sessions.delete(token);
    if (shouldUseDevelopmentFallback()) {
      const db = getDb();
      const user: User = { ...db.currentUser };
      const devToken = newSession(user);
      setSessionCookie(res, devToken);
      res.json({ success: true, authenticated: true, user });
      return;
    }
    res.status(401).json({ success: false, authenticated: false });
    return;
  }
  active.lastSeenAt = Date.now();
  res.json({ success: true, authenticated: true, user: active.user });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  cleanupSessions();
  if (process.env.NODE_ENV === 'production' && !isProductionAuthConfigured()) {
    res.status(503).json({ success: false, error: 'Production authentication is not configured.' });
    return;
  }

  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) {
    if (shouldUseDevelopmentFallback()) {
      const db = getDb();
      (req as Request & { forgexUser?: User }).forgexUser = { ...db.currentUser };
      return next();
    }
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }
  const active = sessions.get(token);
  if (!active || Date.now() - active.lastSeenAt > SESSION_TTL_MS) {
    sessions.delete(token);
    if (shouldUseDevelopmentFallback()) {
      const db = getDb();
      (req as Request & { forgexUser?: User }).forgexUser = { ...db.currentUser };
      return next();
    }
    res.status(401).json({ success: false, error: 'Session expired. Please sign in again.' });
    return;
  }
  active.lastSeenAt = Date.now();
  (req as Request & { forgexUser?: User }).forgexUser = { ...active.user };
  next();
}

export function logout(req: Request, res: Response): void {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) sessions.delete(token);
  setSessionCookie(res, '', true);
  res.json({ success: true });
}

export function updateSessionRole(req: Request, role: UserRole): void {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return;
  const active = sessions.get(token);
  if (active) active.user.role = role;
}
