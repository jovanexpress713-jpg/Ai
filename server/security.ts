import type { Request, Response, NextFunction } from 'express';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

export function sameOriginForStateChange(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING.has(req.method) || req.path === '/api/auth/login') return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  const host = (req.headers['x-forwarded-host'] || req.headers.host) as string;
  try {
    const originUrl = new URL(origin);
    if (host && originUrl.host !== host && !originUrl.host.includes('run.app') && !originUrl.host.includes('localhost')) {
      res.status(403).json({ success: false, error: 'Cross-origin state-changing request rejected.' });
      return;
    }
  } catch {
    res.status(403).json({ success: false, error: 'Invalid Origin header.' });
    return;
  }
  next();
}
