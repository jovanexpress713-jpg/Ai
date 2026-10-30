import express, { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  getDb,
  saveDb,
  checkPermission,
  addMessageToConversation,
  updateAgentTask,
  recordAuditLog,
  TerminalEntry,
} from './server/db.ts';
import {
  getWorkspaceFileTree,
  readWorkspaceFile,
  writeWorkspaceFile,
  createWorkspaceItem,
  deleteWorkspaceItem,
  renameWorkspaceItem,
  undoFileChange,
  computeUnifiedDiff,
} from './server/workspace-fs.ts';
import {
  testGeminiConnection,
  runAutonomousCycle,
  applyTaskChanges,
  rejectTaskChanges,
} from './server/agent.ts';
import { login, logout, session, requireAuth, getAuthenticatedUser, updateSessionRole } from './server/auth.ts';
import { isProductionAuthConfigured } from './server/auth-policy.ts';
import { registerWorkspaceAndIntegrationRoutes } from './server/legacy-routes.ts';
import { securityHeaders, sameOriginForStateChange } from './server/security.ts';
import { deploymentStatus, triggerDeployment } from './server/deployment.ts';

const ROLE_ACTIONS = {
  GEMINI_TEST: 'MANAGE_SETTINGS' as const,
  GITHUB: 'MANAGE_GITHUB' as const,
  REJECT_TASK: 'APPLY_CHANGES' as const,
};

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
app.use(securityHeaders);
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.post('/api/auth/login', login);
app.post('/api/auth/logout', logout);
app.get('/api/auth/session', session);
app.use('/api', sameOriginForStateChange, requireAuth);

function requirePermission(res: Response, action: Parameters<typeof checkPermission>[1]): boolean {
  const user = getAuthenticatedUser(res.req);
  const perm = checkPermission(user?.role || 'Viewer', action);
  if (!perm.allowed) {
    res.status(403).json({ success: false, error: perm.reason });
    return false;
  }
  return true;
}

app.get('/api/health', async (_req: Request, res: Response) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;
  const sandboxMode = process.env.FORGEX_SANDBOX_MODE || (process.env.NODE_ENV === 'production' ? 'bwrap' : 'workspace');
  const hasSandbox = sandboxMode === 'workspace' || (sandboxMode === 'bwrap' && fs.existsSync('/usr/bin/bwrap'));
  const healthData = {
    gemini: { status: geminiKey && geminiKey.trim() !== '' && geminiKey !== 'MY_GEMINI_API_KEY' ? 'connected' : 'not_configured', model: 'gemini-3.8-flash', reason: geminiKey ? undefined : 'GEMINI_API_KEY environment variable is not configured.' },
    github: { status: githubToken && githubToken.trim() !== '' ? 'connected' : 'not_configured', reason: githubToken ? undefined : 'GITHUB_TOKEN environment variable is not configured.' },
    database: { status: 'connected', engine: 'JSON-Persistent-Store', path: 'data/forgex_db.json' },
    executionEnv: { status: 'connected', nodeVersion: process.version, platform: process.platform },
    sandbox: { status: hasSandbox ? 'connected' : 'not_configured', mode: sandboxMode, reason: hasSandbox ? undefined : 'Isolated execution sandbox is not installed/configured.' },
    preview: { status: 'connected', port: PORT, url: `http://localhost:${PORT}` },
    deployment: (() => { const status = deploymentStatus(); return { status: status.configured ? 'connected' : 'not_configured', provider: status.provider, githubActions: status.githubActions, vercelHook: status.vercelHook, reason: status.configured ? undefined : 'No deployment provider is configured.' }; })(),
  };
  res.json({ success: true, timestamp: new Date().toISOString(), services: healthData });
});

app.post('/api/gemini/test', async (_req: Request, res: Response) => {
  if (!requirePermission(res, ROLE_ACTIONS.GEMINI_TEST)) return;
  try {
    const result = await testGeminiConnection();
    if (!result.configured) return res.status(400).json({ success: false, status: 'Not Configured', message: 'Gemini — Not Configured. GEMINI_API_KEY is missing.', result });
    if (!result.connected) return res.status(502).json({ success: false, status: 'Error', message: `Gemini Connection Failed: ${result.error}`, result });
    res.json({ success: true, status: 'Connected', message: 'Gemini connection verified successfully.', result });
  } catch (err: any) { res.status(500).json({ success: false, status: 'Error', error: err.message || 'Internal error testing Gemini' }); }
});

app.post('/api/agent/process', async (req: Request, res: Response) => {
  const prompt = String(req.body?.prompt || '').trim();
  const autoApply = req.body?.autoApplyIfVerified === true;
  const assignedAgent = typeof req.body?.assignedAgent === 'string' ? req.body.assignedAgent : 'Planner';
  const user = getAuthenticatedUser(req);
  if (!prompt) return res.status(400).json({ success: false, error: 'prompt is required' });
  const perm = checkPermission(user?.role || 'Viewer', 'APPLY_CHANGES');
  if (autoApply && !perm.allowed) return res.status(403).json({ success: false, error: perm.reason });
  try {
    const task = await runAutonomousCycle({ userRequest: prompt, assignedAgent, requestedBy: user?.name || 'Authenticated User', autoApplyIfVerified: autoApply && perm.allowed });
    res.json({ success: true, task });
  } catch (error: any) { res.status(500).json({ success: false, error: 'حدث خطأ أثناء معالجة الطلب', details: error?.message }); }
});

app.post('/api/agent/cycle', async (req: Request, res: Response) => {
  const { userRequest, assignedAgent, requestedBy, targetFiles, autoApplyIfVerified } = req.body;
  if (!userRequest || typeof userRequest !== 'string') return res.status(400).json({ error: 'userRequest is required' });
  const user = getAuthenticatedUser(req);
  const perm = checkPermission(user?.role || 'Viewer', 'APPLY_CHANGES');
  if (autoApplyIfVerified && !perm.allowed) return res.status(403).json({ error: perm.reason });
  try {
    const task = await runAutonomousCycle({ userRequest, assignedAgent, requestedBy: requestedBy || user?.name || 'Authenticated User', targetFiles, autoApplyIfVerified: autoApplyIfVerified && perm.allowed });
    res.json({ success: true, task });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message || 'Agent cycle failed' }); }
});

app.post('/api/agent/task/:id/apply', async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  const perm = checkPermission(user?.role || 'Viewer', 'APPLY_CHANGES');
  if (!perm.allowed) return res.status(403).json({ error: perm.reason });
  try { const task = await applyTaskChanges(req.params.id); res.json({ success: true, task }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/agent/task/:id/reject', (req: Request, res: Response) => {
  if (!requirePermission(res, ROLE_ACTIONS.REJECT_TASK)) return;
  try { const task = rejectTaskChanges(req.params.id); res.json({ success: true, task }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/fs/tree', (_req: Request, res: Response) => {
  if (!requirePermission(res, 'READ_FILE')) return;
  try { res.json({ success: true, tree: getWorkspaceFileTree('.') }); }
  catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/fs/read', (req: Request, res: Response) => {
  if (!requirePermission(res, 'READ_FILE')) return;
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'path parameter is required' });
  try { res.json({ success: true, file: readWorkspaceFile(filePath) }); }
  catch (err: any) { res.status(404).json({ success: false, error: err.message }); }
});

registerWorkspaceAndIntegrationRoutes(app, requirePermission, getAuthenticatedUser);

app.post('/api/deploy', async (req: Request, res: Response) => {
  if (!requirePermission(res, 'DEPLOY')) return;
  const user = getAuthenticatedUser(req);
  try { const result = await triggerDeployment(user?.name || 'Authenticated User'); res.status(result.success ? 200 : 502).json(result); }
  catch (err: any) { res.status(500).json({ success: false, error: err?.message || 'Deployment failed.' }); }
});

async function startServer() {
  if (isProd && !isProductionAuthConfigured()) throw new Error('Production authentication is not configured. Set FORGEX_ADMIN_EMAIL and FORGEX_ADMIN_PASSWORD (minimum 16 characters).');
  if (isProd && (process.env.FORGEX_SANDBOX_MODE || 'bwrap') === 'bwrap' && !fs.existsSync('/usr/bin/bwrap') && !fs.existsSync('/bin/bwrap')) throw new Error('bubblewrap is required for isolated execution in production mode.');
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
    app.use('*', async (req: Request, res: Response, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      try {
        const template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e: any) { vite.ssrFixStacktrace(e); next(e); }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => res.sendFile(path.resolve(__dirname, 'dist', 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`[FORGEX AI] Server running on http://0.0.0.0:${PORT}`));
}

startServer().catch((err) => { console.error('[FORGEX AI] Failed to start server:', err); process.exit(1); });
