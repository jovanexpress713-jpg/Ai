import type { Express, Request, Response } from 'express';
import { getDb, saveDb, checkPermission, recordAuditLog, TerminalEntry } from './db.ts';

type PermissionGuard = (res: Response, action: Parameters<typeof checkPermission>[1]) => boolean;

export function registerTerminalRoute(app: Express, requirePermission: PermissionGuard, getAuthenticatedUser: (req: Request) => any): void {
  app.post('/api/terminal/execute', (req: Request, res: Response) => {
    const { command } = req.body;
    if (!command || typeof command !== 'string') return res.status(400).json({ error: 'command is required' });
    if (!requirePermission(res, 'TERMINAL_EXEC')) return;

    const trimmed = command.trim();
    const allowedPatterns = [
      /^pwd$/i,
      /^(ls|find|cat|head|tail|grep|rg|printf|echo)(?:\s+[a-zA-Z0-9_./@:+=-]+)*$/i,
      /^npm\s+(run\s+(lint|build|verify|test|check)|test|--version)$/i,
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
      recordAuditLog('SECURITY', `Command rejected by execution policy: ${trimmed}`, getAuthenticatedUser(req)?.name || 'Unknown');
      return res.status(403).json({ success: false, status: 'REJECTED', error: 'Command rejected by FORGEX execution policy. Only approved workspace-safe development commands are allowed.' });
    }

    const sandboxRequired = process.env.NODE_ENV === 'production' || process.env.FORGEX_SANDBOX_REQUIRED === 'true';
    const start = Date.now();
    import('./sandbox.ts').then(({ executeSandboxCommand }) =>
      executeSandboxCommand(trimmed, { requireIsolation: sandboxRequired })
        .then(({ stdout, stderr, exitCode }) => {
          const durationMs = Date.now() - start;
          const status = exitCode === 0 ? 'SUCCESS' : 'ERROR';
          const entry: TerminalEntry = {
            id: `term_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            command: trimmed,
            stdout: stdout || '',
            stderr: stderr || '',
            exitCode,
            durationMs,
            timestamp: new Date().toISOString(),
            status,
          };
          const db = getDb();
          db.terminalHistory.unshift(entry);
          db.terminalHistory = db.terminalHistory.slice(0, 100);
          saveDb(db);
          recordAuditLog('TERMINAL', `Executed: ${trimmed} (${status}, exit ${exitCode})`, getAuthenticatedUser(req)?.name || 'Unknown');
          res.json({ success: true, entry });
        })
        .catch((err: any) => {
          recordAuditLog('SECURITY', `Sandbox execution rejected: ${trimmed}`, getAuthenticatedUser(req)?.name || 'Unknown');
          res.status(err?.code === 'SANDBOX_UNAVAILABLE' ? 503 : 422).json({ success: false, status: err?.code || 'REJECTED', error: err?.message || 'Sandbox execution failed.' });
        })
    );
  });
}
