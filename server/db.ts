import fs from 'node:fs';
import path from 'node:path';

export type UserRole = 'Owner' | 'Admin' | 'Developer' | 'Reviewer' | 'Viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  isCurrent: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  agent?: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface Conversation {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

export type AgentCycleState =
  | 'PENDING'
  | 'ANALYZING'
  | 'PLANNING'
  | 'EXECUTING'
  | 'WAITING_APPROVAL'
  | 'VERIFYING'
  | 'APPLYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface ProposedFileChange {
  filePath: string;
  originalContent: string;
  newContent: string;
  diffSummary: {
    additions: number;
    deletions: number;
    changes: number;
  };
  applied: boolean;
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  requestedBy: string;
  assignedAgent: string;
  state: AgentCycleState;
  createdAt: string;
  updatedAt: string;
  steps: {
    title: string;
    state: AgentCycleState;
    agent: string;
    detail?: string;
    timestamp: string;
  }[];
  proposedChanges: ProposedFileChange[];
  verificationResult?: {
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
    command: string;
  };
  error?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  type: 'SYSTEM' | 'SECURITY' | 'FILE' | 'TERMINAL' | 'AGENT';
  message: string;
  user: string;
  details?: Record<string, any>;
}

export interface TerminalEntry {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timestamp: string;
  status: 'SUCCESS' | 'ERROR' | 'REJECTED';
}

export interface DbSchema {
  version: string;
  currentUser: User;
  projects: Project[];
  tasks: AgentTask[];
  conversations: Conversation[];
  terminalHistory: TerminalEntry[];
  fileBackups: Record<string, string[]>; // filePath -> array of backups
  auditLogs: AuditLog[];
}

const DB_PATH = path.resolve(process.cwd(), 'data/forgex_db.json');

function ensureDbFile(): DbSchema {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    const initial: DbSchema = {
      version: '1.0.0',
      currentUser: {
        id: 'usr_owner_1',
        name: 'Lead Engineer',
        email: 'hhhertwg@gmail.com',
        role: 'Owner',
      },
      projects: [
        {
          id: 'proj_current',
          name: 'FORGEX AI Workspace',
          description: 'Active workspace environment for FORGEX AI autonomous engineering platform',
          path: '.',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isCurrent: true,
        },
      ],
      tasks: [],
      conversations: [
        {
          id: 'conv_main',
          projectId: 'proj_current',
          title: 'FORGEX Autonomous Session',
          createdAt: new Date().toISOString(),
          messages: [
            {
              id: 'msg_sys_init',
              role: 'assistant',
              agent: 'Planner',
              content: 'نظام FORGEX AI جاهز للعمل. تم ربط مساحة العمل الحقيقية وقاعدة البيانات المستمرة.',
              timestamp: new Date().toISOString(),
            },
          ],
        },
      ],
      terminalHistory: [],
      fileBackups: {},
      auditLogs: [
        {
          id: 'log_init',
          timestamp: new Date().toISOString(),
          type: 'SYSTEM',
          message: 'Database storage initialized.',
          user: 'Lead Engineer',
        },
      ],
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }

  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading DB, re-initializing backup:', err);
    return ensureDbFile();
  }
}

let cachedDb: DbSchema = ensureDbFile();

export function getDb(): DbSchema {
  try {
    cachedDb = ensureDbFile();
  } catch {}
  return cachedDb;
}

export function saveDb(data: DbSchema): void {
  cachedDb = data;
  const tmpPath = `${DB_PATH}.tmp-${process.pid}-${Date.now()}`;
  try {
    const payload = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmpPath, payload, { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tmpPath, DB_PATH);
  } catch (err) {
    try { fs.rmSync(tmpPath, { force: true }); } catch {}
    console.error('Failed to atomically write DB file:', err);
    throw err;
  }
}

// Permissions check (RBAC)
export function checkPermission(
  role: UserRole,
  action: 'READ_FILE' | 'EDIT_FILE' | 'TERMINAL_EXEC' | 'APPLY_CHANGES' | 'MANAGE_GITHUB' | 'MANAGE_SETTINGS' | 'DEPLOY'
): { allowed: boolean; reason?: string } {
  switch (action) {
    case 'READ_FILE':
      return { allowed: true };
    case 'EDIT_FILE':
    case 'APPLY_CHANGES':
      if (['Owner', 'Admin', 'Developer'].includes(role)) return { allowed: true };
      return { allowed: false, reason: `Role ${role} is not permitted to modify files.` };
    case 'TERMINAL_EXEC':
      if (['Owner', 'Admin'].includes(role)) return { allowed: true };
      return { allowed: false, reason: `Role ${role} cannot execute shell commands. Requires Owner or Admin.` };
    case 'MANAGE_GITHUB':
      if (['Owner', 'Admin', 'Developer'].includes(role)) return { allowed: true };
      return { allowed: false, reason: `Role ${role} cannot create GitHub branches/PRs.` };
    case 'DEPLOY':
      if (['Owner', 'Admin'].includes(role)) return { allowed: true };
      return { allowed: false, reason: `Role ${role} cannot trigger deployment. Requires Owner or Admin.` };
    case 'MANAGE_SETTINGS':
      if (['Owner', 'Admin'].includes(role)) return { allowed: true };
      return { allowed: false, reason: `Role ${role} cannot alter settings or roles.` };
    default:
      return { allowed: false, reason: 'Unknown action' };
  }
}

// Conversation helpers
export function addMessageToConversation(conversationId: string, message: ChatMessage): Conversation {
  const db = getDb();
  let conv = db.conversations.find((c) => c.id === conversationId);
  if (!conv) {
    conv = {
      id: conversationId,
      projectId: 'proj_current',
      title: 'New Session',
      createdAt: new Date().toISOString(),
      messages: [],
    };
    db.conversations.push(conv);
  }
  conv.messages.push(message);
  saveDb(db);
  return conv;
}

// Task helpers
export function createAgentTask(task: Omit<AgentTask, 'id' | 'createdAt' | 'updatedAt'>): AgentTask {
  const db = getDb();
  const newTask: AgentTask = {
    ...task,
    id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.tasks.unshift(newTask);
  saveDb(db);
  return newTask;
}

export function updateAgentTask(taskId: string, patch: Partial<AgentTask>): AgentTask | null {
  const db = getDb();
  const index = db.tasks.findIndex((t) => t.id === taskId);
  if (index === -1) return null;
  db.tasks[index] = {
    ...db.tasks[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  saveDb(db);
  return db.tasks[index];
}

// Backup helpers for undo
export function storeFileBackup(filePath: string, content: string): void {
  const db = getDb();
  if (!db.fileBackups[filePath]) {
    db.fileBackups[filePath] = [];
  }
  // keep up to 15 revisions
  db.fileBackups[filePath].push(content);
  if (db.fileBackups[filePath].length > 15) {
    db.fileBackups[filePath].shift();
  }
  saveDb(db);
}

export function popFileBackup(filePath: string): string | null {
  const db = getDb();
  if (!db.fileBackups[filePath] || db.fileBackups[filePath].length === 0) {
    return null;
  }
  const prev = db.fileBackups[filePath].pop();
  saveDb(db);
  return prev || null;
}

// Audit helpers
export function recordAuditLog(
  type: AuditLog['type'],
  message: string,
  user: string = 'System',
  details?: Record<string, any>
): void {
  const db = getDb();
  db.auditLogs.unshift({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
    timestamp: new Date().toISOString(),
    type,
    message,
    user,
    details,
  });
  if (db.auditLogs.length > 200) {
    db.auditLogs = db.auditLogs.slice(0, 200);
  }
  saveDb(db);
}
