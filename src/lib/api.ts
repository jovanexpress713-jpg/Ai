import {
  SystemHealthData,
  FileNode,
  FileDiffResult,
  AgentTask,
  DbData,
  TerminalEntry,
  UserRole,
  ChatMessage,
} from '../types';

export async function fetchSession(): Promise<{ authenticated: boolean; user?: any }> {
  const res = await fetch('/api/auth/session');
  const data = await res.json();
  if (!res.ok) return { authenticated: false };
  return data;
}

export async function login(email: string, password: string): Promise<any> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Login failed');
  return data.user;
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}

export async function fetchHealth(): Promise<SystemHealthData> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('Failed to fetch health');
  const data = await res.json();
  return data.services;
}

export async function testGemini(): Promise<{
  success: boolean;
  status: string;
  message: string;
  result: any;
}> {
  const res = await fetch('/api/gemini/test', { method: 'POST' });
  const data = await res.json();
  return data;
}

export async function runAgentCycle(params: {
  userRequest: string;
  assignedAgent?: string;
  targetFiles?: string[];
  autoApplyIfVerified?: boolean;
}): Promise<AgentTask> {
  const res = await fetch('/api/agent/cycle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to run autonomous agent cycle');
  }
  return data.task;
}

export async function applyTask(taskId: string): Promise<AgentTask> {
  const res = await fetch(`/api/agent/task/${taskId}/apply`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to apply task changes');
  }
  return data.task;
}

export const applyTaskChanges = applyTask;

export async function rejectTask(taskId: string): Promise<AgentTask> {
  const res = await fetch(`/api/agent/task/${taskId}/reject`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to reject task changes');
  }
  return data.task;
}

export const rejectTaskChanges = rejectTask;

export async function fetchFileTree(): Promise<FileNode[]> {
  const res = await fetch('/api/fs/tree');
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch file tree');
  return data.tree;
}

export async function readFile(path: string): Promise<{ content: string; relPath: string; size: number }> {
  const res = await fetch(`/api/fs/read?path=${encodeURIComponent(path)}`);
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || `Failed to read file ${path}`);
  return data.file;
}

export async function writeFile(path: string, content: string): Promise<void> {
  const res = await fetch('/api/fs/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || `Failed to write file ${path}`);
}

export async function createFileOrDir(path: string, isDirectory: boolean, initialContent?: string): Promise<void> {
  const res = await fetch('/api/fs/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, isDirectory, initialContent }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || `Failed to create ${path}`);
}

export async function deleteFileOrDir(path: string): Promise<void> {
  const res = await fetch(`/api/fs/delete?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || `Failed to delete ${path}`);
}

export async function renameFileOrDir(from: string, to: string): Promise<void> {
  const res = await fetch('/api/fs/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || `Failed to rename ${from}`);
}

export async function undoFile(path: string): Promise<string> {
  const res = await fetch('/api/fs/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || `No undo revision found for ${path}`);
  return data.result.restoredContent;
}

export async function computeDiff(original: string, modified: string, filePath?: string): Promise<FileDiffResult> {
  const res = await fetch('/api/fs/diff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ original, modified, filePath }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to compute diff');
  return data.diff;
}

export async function executeTerminalCommand(command: string): Promise<TerminalEntry> {
  const res = await fetch('/api/terminal/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Terminal command execution failed');
  }
  return data.entry;
}

export async function runVerification(type: 'lint' | 'build'): Promise<{
  success: boolean;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}> {
  const res = await fetch('/api/build/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  });
  return res.json();
}

export async function fetchDb(): Promise<DbData> {
  const res = await fetch('/api/db/data');
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error('Failed to fetch persistent DB');
  return data.data;
}

export async function sendChatMessage(content: string, agent?: string, conversationId = 'conv_main'): Promise<ChatMessage> {
  const res = await fetch('/api/db/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      message: {
        role: 'user',
        agent,
        content,
      },
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error('Failed to send message');
  return data.message;
}

export async function updateUserRole(role: UserRole): Promise<void> {
  const res = await fetch('/api/db/user/role', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update user role');
}

export async function fetchGitHubStatus(): Promise<{
  configured: boolean;
  status: string;
  message?: string;
  user?: { login: string; name: string; avatar_url: string };
}> {
  const res = await fetch('/api/github/status');
  return res.json();
}

export async function fetchGitHubRepos(): Promise<{
  configured: boolean;
  repos?: Array<{
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    html_url: string;
    default_branch: string;
    updated_at: string;
    private: boolean;
  }>;
  error?: string;
}> {
  const res = await fetch('/api/github/repos');
  return res.json();
}

export async function fetchGitHubBranches(repo: string): Promise<{
  success: boolean;
  branches?: Array<{ name: string; commit: { sha: string } }>;
  error?: string;
}> {
  const res = await fetch(`/api/github/branches?repo=${encodeURIComponent(repo)}`);
  return res.json();
}

export interface SyncGitHubParams {
  repo: string;
  branch?: string;
  message?: string;
  filePaths?: string[];
}

export interface SyncGitHubResult {
  success: boolean;
  commitSha: string;
  commitUrl: string;
  branch: string;
  repo: string;
  syncedFilesCount: number;
  files: string[];
  timestamp: string;
}

export async function syncWithGitHub(params: SyncGitHubParams): Promise<SyncGitHubResult> {
  const res = await fetch('/api/github/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to sync with GitHub repository');
  }
  return data;
}

