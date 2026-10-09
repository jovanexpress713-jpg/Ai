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
  processAgentTask,
} from './server/agent.ts';
import { login, logout, session, requireAuth, getAuthenticatedUser, updateSessionRole } from './server/auth.ts';
import { securityHeaders, sameOriginForStateChange } from './server/security.ts';
import { deploymentStatus, triggerDeployment } from './server/deployment.ts';
import { syncWorkspaceToGitHub, fetchRepoBranches } from './server/github.ts';

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

// Authentication is mandatory in production. Development gets a temporary local session.
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

// -------------------------------------------------------------
// 1. Unified Integration Health Check
// -------------------------------------------------------------
app.get('/api/health', async (_req: Request, res: Response) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;
  const sandboxMode = process.env.FORGEX_SANDBOX_MODE || (process.env.NODE_ENV === 'production' ? 'bwrap' : 'workspace');
  const hasSandbox = sandboxMode === 'workspace' || (sandboxMode === 'bwrap' && fs.existsSync('/usr/bin/bwrap'));
  const deploy = deploymentStatus();

  const healthData = {
    gemini: {
      status: geminiKey && geminiKey.trim() !== '' && geminiKey !== 'MY_GEMINI_API_KEY' ? 'connected' : 'not_configured',
      model: 'gemini-3.8-flash',
      reason: geminiKey ? undefined : 'GEMINI_API_KEY environment variable is not configured.',
    },
    github: {
      status: githubToken && githubToken.trim() !== '' ? 'connected' : 'not_configured',
      reason: githubToken ? undefined : 'GITHUB_TOKEN environment variable is not configured.',
    },
    database: {
      status: 'connected',
      engine: 'JSON-Persistent-Store',
      path: 'data/forgex_db.json',
    },
    executionEnv: {
      status: 'connected',
      nodeVersion: process.version,
      platform: process.platform,
    },
    sandbox: {
      status: hasSandbox ? 'connected' : 'not_configured',
      mode: sandboxMode,
      reason: hasSandbox ? undefined : 'Isolated execution sandbox is not installed/configured.',
    },
    preview: {
      status: 'connected',
      port: PORT,
      url: `http://localhost:${PORT}`,
    },
    deployment: (() => {
      const status = deploymentStatus();
      return {
        status: status.configured ? 'connected' : 'not_configured',
        provider: status.provider,
        githubActions: status.githubActions,
        vercelHook: status.vercelHook,
        reason: status.configured ? undefined : 'No deployment provider is configured.',
      };
    })(),
  };

  res.json({ success: true, timestamp: new Date().toISOString(), services: healthData });
});

// -------------------------------------------------------------
// 2. Gemini Real Connection Test & Diagnostics
// -------------------------------------------------------------
app.post('/api/gemini/test', async (req: Request, res: Response) => {
  if (!requirePermission(res, ROLE_ACTIONS.GEMINI_TEST)) return;
  try {
    const result = await testGeminiConnection();
    if (!result.configured) {
      return res.status(400).json({
        success: false,
        status: 'Not Configured',
        message: 'Gemini — Not Configured. GEMINI_API_KEY is missing.',
        result,
      });
    }
    if (!result.connected) {
      return res.status(502).json({
        success: false,
        status: 'Error',
        message: `Gemini Connection Failed: ${result.error}`,
        result,
      });
    }
    res.json({
      success: true,
      status: 'Connected',
      message: 'Gemini connection verified successfully.',
      result,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      status: 'Error',
      error: err.message || 'Internal error testing Gemini',
    });
  }
});

// -------------------------------------------------------------
// 3. Autonomous Agent Cycle & Studio Processing
// -------------------------------------------------------------
app.post('/api/agent/process', async (req: Request, res: Response) => {
  try {
    const prompt = String(req.body?.prompt || '');
    if (!prompt.trim()) {
      return res.status(400).json({ error: 'prompt is required' });
    }
    const result = await processAgentTask(prompt);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'حدث خطأ أثناء معالجة الطلب', details: error?.message });
  }
});

app.post('/api/agent/cycle', async (req: Request, res: Response) => {
  const { userRequest, assignedAgent, requestedBy, targetFiles, autoApplyIfVerified } = req.body;

  if (!userRequest || typeof userRequest !== 'string') {
    return res.status(400).json({ error: 'userRequest is required' });
  }

  const user = getAuthenticatedUser(req);
  const perm = checkPermission(user?.role || 'Viewer', 'APPLY_CHANGES');
  if (autoApplyIfVerified && !perm.allowed) {
    return res.status(403).json({ error: perm.reason });
  }

  try {
    const task = await runAutonomousCycle({
      userRequest,
      assignedAgent,
      requestedBy: requestedBy || user?.name || 'Authenticated User',
      targetFiles,
      autoApplyIfVerified: autoApplyIfVerified && perm.allowed,
    });

    res.json({ success: true, task });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Agent cycle failed' });
  }
});

app.post('/api/agent/task/:id/apply', async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  const perm = checkPermission(user?.role || 'Viewer', 'APPLY_CHANGES');
  if (!perm.allowed) {
    return res.status(403).json({ error: perm.reason });
  }

  try {
    const task = await applyTaskChanges(req.params.id);
    res.json({ success: true, task });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/agent/task/:id/reject', (req: Request, res: Response) => {
  if (!requirePermission(res, ROLE_ACTIONS.REJECT_TASK)) return;
  try {
    const task = rejectTaskChanges(req.params.id);
    res.json({ success: true, task });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 4. Real File Manager Endpoints
// -------------------------------------------------------------
app.get('/api/fs/tree', (_req: Request, res: Response) => {
  if (!requirePermission(res, 'READ_FILE')) return;
  try {
    const tree = getWorkspaceFileTree('.');
    res.json({ success: true, tree });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/fs/read', (req: Request, res: Response) => {
  if (!requirePermission(res, 'READ_FILE')) return;
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'path parameter is required' });

  try {
    const file = readWorkspaceFile(filePath);
    res.json({ success: true, file });
  } catch (err: any) {
    res.status(404).json({ success: false, error: err.message });
  }
});

app.post('/api/fs/write', (req: Request, res: Response) => {
  const { path: filePath, content } = req.body;
  if (!filePath || content === undefined) {
    return res.status(400).json({ error: 'path and content are required' });
  }

  const user = getAuthenticatedUser(req);
  const perm = checkPermission(user?.role || 'Viewer', 'EDIT_FILE');
  if (!perm.allowed) {
    return res.status(403).json({ error: perm.reason });
  }

  try {
    const result = writeWorkspaceFile(filePath, content);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/fs/create', (req: Request, res: Response) => {
  const { path: filePath, isDirectory, initialContent } = req.body;
  if (!filePath) return res.status(400).json({ error: 'path is required' });

  const user = getAuthenticatedUser(req);
  const perm = checkPermission(user?.role || 'Viewer', 'EDIT_FILE');
  if (!perm.allowed) {
    return res.status(403).json({ error: perm.reason });
  }

  try {
    const result = createWorkspaceItem(filePath, isDirectory, initialContent || '');
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/fs/delete', (req: Request, res: Response) => {
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'path is required' });

  const user = getAuthenticatedUser(req);
  const perm = checkPermission(user?.role || 'Viewer', 'EDIT_FILE');
  if (!perm.allowed) {
    return res.status(403).json({ error: perm.reason });
  }

  try {
    const result = deleteWorkspaceItem(filePath);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/fs/rename', (req: Request, res: Response) => {
  const { from, to } = req.body;
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

  const user = getAuthenticatedUser(req);
  const perm = checkPermission(user?.role || 'Viewer', 'EDIT_FILE');
  if (!perm.allowed) {
    return res.status(403).json({ error: perm.reason });
  }

  try {
    const result = renameWorkspaceItem(from, to);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/fs/restore', (req: Request, res: Response) => {
  const { path: filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'path is required' });

  const user = getAuthenticatedUser(req);
  const perm = checkPermission(user?.role || 'Viewer', 'EDIT_FILE');
  if (!perm.allowed) {
    return res.status(403).json({ error: perm.reason });
  }

  try {
    const result = undoFileChange(filePath);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/fs/diff', (req: Request, res: Response) => {
  if (!requirePermission(res, 'READ_FILE')) return;
  const { original, modified, filePath } = req.body;
  if (original === undefined || modified === undefined) {
    return res.status(400).json({ error: 'original and modified texts required' });
  }
  const diff = computeUnifiedDiff(original, modified, filePath || 'file');
  res.json({ success: true, diff });
});

// -------------------------------------------------------------
// 5. Safe Real Terminal Command Runner
// -------------------------------------------------------------
app.post('/api/terminal/execute', (req: Request, res: Response) => {
  const { command } = req.body;
  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'command is required' });
  }

  const user = getAuthenticatedUser(req);
  const perm = checkPermission(user?.role || 'Viewer', 'TERMINAL_EXEC');
  if (!perm.allowed) {
    return res.status(403).json({ error: perm.reason });
  }

  const trimmed = command.trim();

  // Strict command grammar. In production, arbitrary host execution is disabled unless
  // Docker isolation is explicitly available and enabled. The allowlist also prevents shell
  // composition, redirection, arbitrary scripts, destructive git operations, and secret access.
  const allowedPatterns = [
    /^pwd$/i,
    /^(ls|find|cat|head|tail|grep|rg|printf|echo)(?:\s+[a-zA-Z0-9_./@:+=-]+)*$/i,
    /^npm\s+(run\s+(lint|build|verify|test)|test|--version)$/i,
    /^npx\s+(vite\s+build|tsc(?:\s+--noEmit)?)$/i,
    /^node\s+--version$/i,
    /^git\s+(status|diff|log(?:\s+--oneline)?|branch|show(?:\s+[a-zA-Z0-9._/-]+)?)$/i,
  ];
  const forbiddenTokens = [
    /[;&|`$(){}<>\n\r]/,
    /(^|\s)(curl|wget|ssh|scp|sudo|su|chmod|chown|mount|umount|kill|pkill|dd|mkfs|shutdown|reboot|docker|podman|kubectl)(\s|$)/i,
    /(^|\s)(rm|mv|cp|touch|ln)(\s|$)/i,
    /(^|\s)(python|perl|ruby|php|bash|sh|zsh|fish)(\s|$)/i,
    /\.\.(?:[\/\\])/,
    /(?:^|[\/\\])(?:etc|root|proc|sys|dev|boot|home)(?:[\/\\]|$)/i,
    /(?:^|[\s\/\\])(?:\.env(?:\.[^\s/\\]+)?|id_rsa|authorized_keys|package-lock\.json)(?:$|[\s/\\])/i,
    /git\s+(reset|clean|checkout|restore|rebase|push|commit|merge|cherry-pick)/i,
  ];
  if (!allowedPatterns.some((pattern) => pattern.test(trimmed)) || forbiddenTokens.some((pattern) => pattern.test(trimmed))) {
    recordAuditLog('SECURITY', `Command rejected by execution policy: ${trimmed}`, user?.name || 'Unknown');
    return res.status(403).json({
      success: false,
      status: 'REJECTED',
      error: 'Command rejected by FORGEX execution policy. Only approved workspace-safe development commands are allowed.',
    });
  }

  const sandboxRequired = process.env.NODE_ENV === 'production' || process.env.FORGEX_SANDBOX_REQUIRED === 'true';
  const start = Date.now();
  import('./server/sandbox.ts').then(({ executeSandboxCommand }) =>
    executeSandboxCommand(trimmed, { requireIsolation: sandboxRequired })
      .then(({ stdout, stderr, exitCode }) => {
        const durationMs = Date.now() - start;
        const status = exitCode === 0 ? 'SUCCESS' : 'ERROR';
        const entry: TerminalEntry = {
          id: `term_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          command: trimmed, stdout: stdout || '', stderr: stderr || '', exitCode, durationMs,
          timestamp: new Date().toISOString(), status,
        };
        const db = getDb();
        db.terminalHistory.unshift(entry);
        db.terminalHistory = db.terminalHistory.slice(0, 100);
        saveDb(db);
        recordAuditLog('TERMINAL', `Executed: ${trimmed} (${status}, exit ${exitCode})`, user?.name || 'Unknown');
        res.json({ success: true, entry });
      })
      .catch((err: any) => {
        recordAuditLog('SECURITY', `Sandbox execution rejected: ${trimmed}`, user?.name || 'Unknown');
        res.status(err?.code === 'SANDBOX_UNAVAILABLE' ? 503 : 422).json({
          success: false, status: err?.code || 'REJECTED', error: err?.message || 'Sandbox execution failed.'
        });
      })
  );
});

// -------------------------------------------------------------
// 6. Build Verification Endpoint (Lint & Build)
// -------------------------------------------------------------
app.post('/api/build/verify', async (req: Request, res: Response) => {
  if (!requirePermission(res, 'APPLY_CHANGES')) return;
  const type = (req.body.type as string) || 'lint';
  if (!['lint', 'build', 'test', 'check'].includes(type)) {
    return res.status(400).json({ success: false, error: 'Unsupported verification type.' });
  }
  try {
    const { verifyWorkspace } = await import('./server/sandbox.ts');
    const result = await verifyWorkspace(type);
    res.status(result.success ? 200 : 422).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Verification failed.' });
  }
});

// -------------------------------------------------------------
// 7. Database Persistence & Sessions
// -------------------------------------------------------------
app.get('/api/db/data', (_req: Request, res: Response) => {
  const user = getAuthenticatedUser(_req);
  if (!user || !['Owner', 'Admin', 'Reviewer'].includes(user.role)) {
    res.status(403).json({ success: false, error: 'Database inspection requires Owner, Admin, or Reviewer.' });
    return;
  }
  const db = getDb();
  res.json({ success: true, data: db });
});

app.post('/api/db/message', (req: Request, res: Response) => {
  if (!requirePermission(res, 'READ_FILE')) return;
  const { conversationId, message } = req.body;
  if (!message || !message.content) {
    return res.status(400).json({ error: 'message content is required' });
  }

  const fullMsg = {
    ...message,
    id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
    timestamp: message.timestamp || new Date().toISOString(),
  };

  const conv = addMessageToConversation(conversationId || 'conv_main', fullMsg);
  res.json({ success: true, conversation: conv, message: fullMsg });
});

app.post('/api/db/user/role', (req: Request, res: Response) => {
  const { role } = req.body;
  const validRoles = ['Owner', 'Admin', 'Developer', 'Reviewer', 'Viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
  }

  const db = getDb();
  const user = getAuthenticatedUser(req);
  const perm = checkPermission(user?.role || 'Viewer', 'MANAGE_SETTINGS');
  if (process.env.NODE_ENV === 'production' || !perm.allowed || user?.role !== 'Owner') {
    recordAuditLog('SECURITY', `Blocked role change attempt to ${role}`, user?.name || 'Unknown');
    return res.status(403).json({ success: false, error: 'Role switching is disabled in production; only the Owner may switch roles in development for testing.' });
  }
  db.currentUser.role = role;
  saveDb(db);
  updateSessionRole(req, role);
  recordAuditLog('SECURITY', `User role changed to ${role}`, user?.name || 'Unknown');

  res.json({ success: true, currentUser: { ...db.currentUser, role } });
});

// -------------------------------------------------------------
// 8. GitHub API (Real, with "Not Configured" if missing)
// -------------------------------------------------------------
app.get('/api/github/status', async (req: Request, res: Response) => {
  if (!requirePermission(res, ROLE_ACTIONS.GITHUB)) return;
  const token = process.env.GITHUB_TOKEN;
  if (!token || token.trim() === '') {
    return res.json({
      configured: false,
      status: 'Not Configured',
      message: 'GitHub — Not Configured. GITHUB_TOKEN is not set.',
    });
  }

  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'FORGEX-AI-Platform',
      },
    });

    if (!userRes.ok) {
      return res.status(userRes.status).json({
        configured: true,
        status: 'Error',
        message: `GitHub token invalid or unauthorized: ${userRes.statusText}`,
      });
    }

    const userData = await userRes.json();
    res.json({
      configured: true,
      status: 'Connected',
      user: {
        login: userData.login,
        name: userData.name,
        avatar_url: userData.avatar_url,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      configured: true,
      status: 'Error',
      message: `Failed to connect to GitHub: ${err.message}`,
    });
  }
});

app.get('/api/github/repos', async (req: Request, res: Response) => {
  if (!requirePermission(res, ROLE_ACTIONS.GITHUB)) return;
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(400).json({
      configured: false,
      error: 'GitHub — Not Configured. GITHUB_TOKEN environment variable is missing.',
    });
  }

  try {
    const resp = await fetch('https://api.github.com/user/repos?per_page=50&sort=updated', {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'FORGEX-AI-Platform',
      },
    });
    if (!resp.ok) {
      return res.status(resp.status).json({ error: `GitHub API error: ${resp.statusText}` });
    }
    const repos = await resp.json();
    res.json({ configured: true, repos });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/github/branches', async (req: Request, res: Response) => {
  if (!requirePermission(res, ROLE_ACTIONS.GITHUB)) return;
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(400).json({ error: 'GitHub — Not Configured. GITHUB_TOKEN environment variable is missing.' });
  }
  const repo = req.query.repo as string;
  if (!repo) {
    return res.status(400).json({ error: 'repo parameter is required (e.g. owner/repo).' });
  }

  try {
    const branches = await fetchRepoBranches(repo, token);
    res.json({ success: true, branches });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/github/sync', async (req: Request, res: Response) => {
  if (!requirePermission(res, ROLE_ACTIONS.GITHUB)) return;
  const token = process.env.GITHUB_TOKEN;
  if (!token || token.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'GitHub — Not Configured. GITHUB_TOKEN environment variable is missing.',
    });
  }

  const { repo, branch, message, filePaths } = req.body;
  if (!repo || typeof repo !== 'string') {
    return res.status(400).json({ success: false, error: 'repo (owner/repo) is required.' });
  }

  const user = getAuthenticatedUser(req);

  try {
    const result = await syncWorkspaceToGitHub({
      repo,
      branch,
      message,
      filePaths,
      token,
    });

    recordAuditLog(
      'SYSTEM',
      `Synchronized ${result.syncedFilesCount} files to GitHub repository ${result.repo} on branch ${result.branch}`,
      user?.name || 'Lead Engineer',
      { commitSha: result.commitSha, commitUrl: result.commitUrl }
    );

    res.json(result);
  } catch (err: any) {
    recordAuditLog(
      'SECURITY',
      `Failed to sync with GitHub repository ${repo}: ${err.message}`,
      user?.name || 'Lead Engineer'
    );
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 9. Deployment Adapter
// -------------------------------------------------------------
app.post('/api/deploy', async (req: Request, res: Response) => {
  if (!requirePermission(res, 'DEPLOY')) return;
  const user = getAuthenticatedUser(req);
  try {
    const result = await triggerDeployment(user?.name || 'Authenticated User');
    res.status(result.success ? 200 : 502).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Deployment failed.' });
  }
});

// -------------------------------------------------------------
// 9. Vite Middlewares in Dev / Static Files in Prod
// -------------------------------------------------------------
async function startServer() {
  if (isProd && (!process.env.FORGEX_ADMIN_PASSWORD || process.env.FORGEX_ADMIN_PASSWORD.length < 16)) {
    console.warn('[FORGEX AI] FORGEX_ADMIN_PASSWORD must be at least 16 characters in production; using fallback authentication.');
  }
  if (isProd && process.env.FORGEX_SANDBOX_MODE === 'bwrap' && !fs.existsSync('/usr/bin/bwrap') && !fs.existsSync('/bin/bwrap')) {
    console.warn('[FORGEX AI] bubblewrap is required for isolated execution in production mode; falling back to workspace mode.');
  }
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req: Request, res: Response, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FORGEX AI] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[FORGEX AI] Failed to start server:', err);
  process.exit(1);
});
