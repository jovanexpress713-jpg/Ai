import type { Express, Request, Response } from 'express';
import {
  getDb,
  saveDb,
  checkPermission,
  addMessageToConversation,
  recordAuditLog,
  TerminalEntry,
} from './db.ts';
import {
  writeWorkspaceFile,
  createWorkspaceItem,
  deleteWorkspaceItem,
  renameWorkspaceItem,
  undoFileChange,
  computeUnifiedDiff,
} from './workspace-fs.ts';
import { deploymentStatus, triggerDeployment } from './deployment.ts';
import { syncWorkspaceToGitHub, fetchRepoBranches } from './github.ts';

type PermissionGuard = (res: Response, action: Parameters<typeof checkPermission>[1]) => boolean;

export function registerWorkspaceAndIntegrationRoutes(app: Express, requirePermission: PermissionGuard, getAuthenticatedUser: (req: Request) => any): void {
  app.post('/api/fs/write', (req: Request, res: Response) => {
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) return res.status(400).json({ error: 'path and content are required' });
    if (!requirePermission(res, 'EDIT_FILE')) return;
    try { res.json({ success: true, result: writeWorkspaceFile(filePath, content) }); }
    catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  app.post('/api/fs/create', (req: Request, res: Response) => {
    const { path: filePath, isDirectory, initialContent } = req.body;
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    if (!requirePermission(res, 'EDIT_FILE')) return;
    try { res.json({ success: true, result: createWorkspaceItem(filePath, isDirectory, initialContent || '') }); }
    catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  app.delete('/api/fs/delete', (req: Request, res: Response) => {
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    if (!requirePermission(res, 'EDIT_FILE')) return;
    try { res.json({ success: true, result: deleteWorkspaceItem(filePath) }); }
    catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  app.post('/api/fs/rename', (req: Request, res: Response) => {
    const { from, to } = req.body;
    if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
    if (!requirePermission(res, 'EDIT_FILE')) return;
    try { res.json({ success: true, result: renameWorkspaceItem(from, to) }); }
    catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  app.post('/api/fs/restore', (req: Request, res: Response) => {
    const { path: filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    if (!requirePermission(res, 'EDIT_FILE')) return;
    try { res.json({ success: true, result: undoFileChange(filePath) }); }
    catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  app.post('/api/fs/diff', (req: Request, res: Response) => {
    if (!requirePermission(res, 'READ_FILE')) return;
    const { original, modified, filePath } = req.body;
    if (original === undefined || modified === undefined) return res.status(400).json({ error: 'original and modified texts required' });
    res.json({ success: true, diff: computeUnifiedDiff(original, modified, filePath || 'file') });
  });

  app.post('/api/build/verify', async (req: Request, res: Response) => {
    if (!requirePermission(res, 'APPLY_CHANGES')) return;
    const type = (req.body.type as string) || 'lint';
    if (!['lint', 'build', 'test', 'check'].includes(type)) return res.status(400).json({ success: false, error: 'Unsupported verification type.' });
    try {
      const { verifyWorkspace } = await import('./sandbox.ts');
      const result = await verifyWorkspace(type);
      res.status(result.success ? 200 : 422).json(result);
    } catch (err: any) { res.status(500).json({ success: false, error: err?.message || 'Verification failed.' }); }
  });

  app.get('/api/db/data', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user || !['Owner', 'Admin', 'Reviewer'].includes(user.role)) return res.status(403).json({ success: false, error: 'Database inspection requires Owner, Admin, or Reviewer.' });
    res.json({ success: true, data: getDb() });
  });

  app.post('/api/db/message', (req: Request, res: Response) => {
    if (!requirePermission(res, 'READ_FILE')) return;
    const { conversationId, message } = req.body;
    if (!message || !message.content) return res.status(400).json({ error: 'message content is required' });
    const fullMsg = { ...message, id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`, timestamp: message.timestamp || new Date().toISOString() };
    const conv = addMessageToConversation(conversationId || 'conv_main', fullMsg);
    res.json({ success: true, conversation: conv, message: fullMsg });
  });

  app.post('/api/db/user/role', (req: Request, res: Response) => {
    const { role } = req.body;
    const validRoles = ['Owner', 'Admin', 'Developer', 'Reviewer', 'Viewer'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    const db = getDb();
    const user = getAuthenticatedUser(req);
    const perm = checkPermission(user?.role || 'Viewer', 'MANAGE_SETTINGS');
    if (process.env.NODE_ENV === 'production' || !perm.allowed || user?.role !== 'Owner') {
      recordAuditLog('SECURITY', `Blocked role change attempt to ${role}`, user?.name || 'Unknown');
      return res.status(403).json({ success: false, error: 'Role switching is disabled in production; only the Owner may switch roles in development for testing.' });
    }
    db.currentUser.role = role;
    saveDb(db);
    res.json({ success: true, currentUser: { ...db.currentUser, role } });
  });

  app.get('/api/github/status', async (req: Request, res: Response) => {
    if (!requirePermission(res, 'MANAGE_GITHUB')) return;
    const token = process.env.GITHUB_TOKEN;
    if (!token) return res.json({ configured: false, status: 'Not Configured', message: 'GitHub — Not Configured. GITHUB_TOKEN is not set.' });
    try {
      const userRes = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'FORGEX-AI-Platform' } });
      if (!userRes.ok) return res.status(userRes.status).json({ configured: true, status: 'Error', message: `GitHub token invalid or unauthorized: ${userRes.statusText}` });
      const userData = await userRes.json();
      res.json({ configured: true, status: 'Connected', user: { login: userData.login, name: userData.name, avatar_url: userData.avatar_url } });
    } catch (err: any) { res.status(500).json({ configured: true, status: 'Error', message: `Failed to connect to GitHub: ${err.message}` }); }
  });

  app.get('/api/github/repos', async (req: Request, res: Response) => {
    if (!requirePermission(res, 'MANAGE_GITHUB')) return;
    const token = process.env.GITHUB_TOKEN;
    if (!token) return res.status(400).json({ configured: false, error: 'GitHub — Not Configured. GITHUB_TOKEN environment variable is missing.' });
    try {
      const resp = await fetch('https://api.github.com/user/repos?per_page=50&sort=updated', { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'FORGEX-AI-Platform' } });
      if (!resp.ok) return res.status(resp.status).json({ error: `GitHub API error: ${resp.statusText}` });
      res.json({ configured: true, repos: await resp.json() });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/github/branches', async (req: Request, res: Response) => {
    if (!requirePermission(res, 'MANAGE_GITHUB')) return;
    const token = process.env.GITHUB_TOKEN;
    if (!token) return res.status(400).json({ error: 'GitHub — Not Configured. GITHUB_TOKEN environment variable is missing.' });
    const repo = req.query.repo as string;
    if (!repo) return res.status(400).json({ error: 'repo parameter is required (e.g. owner/repo).' });
    try { res.json({ success: true, branches: await fetchRepoBranches(repo, token) }); }
    catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  app.post('/api/github/sync', async (req: Request, res: Response) => {
    if (!requirePermission(res, 'MANAGE_GITHUB')) return;
    const token = process.env.GITHUB_TOKEN;
    if (!token) return res.status(400).json({ success: false, error: 'GitHub — Not Configured. GITHUB_TOKEN environment variable is missing.' });
    const { repo, branch, message, filePaths } = req.body;
    if (!repo || typeof repo !== 'string') return res.status(400).json({ success: false, error: 'repo (owner/repo) is required.' });
    const user = getAuthenticatedUser(req);
    try {
      const result = await syncWorkspaceToGitHub({ repo, branch, message, filePaths, token });
      recordAuditLog('SYSTEM', `Synchronized ${result.syncedFilesCount} files to GitHub repository ${result.repo} on branch ${result.branch}`, user?.name || 'Lead Engineer', { commitSha: result.commitSha, commitUrl: result.commitUrl });
      res.json(result);
    } catch (err: any) {
      recordAuditLog('SECURITY', `Failed to sync with GitHub repository ${repo}: ${err.message}`, user?.name || 'Lead Engineer');
      res.status(500).json({ success: false, error: err.message });
    }
  });
}
