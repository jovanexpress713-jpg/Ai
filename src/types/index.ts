export type UserRole = 'Owner' | 'Admin' | 'Developer' | 'Reviewer' | 'Viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface ServiceHealth {
  status: 'connected' | 'not_configured' | 'unavailable' | 'error';
  model?: string;
  reason?: string;
  engine?: string;
  path?: string;
  nodeVersion?: string;
  platform?: string;
  port?: number;
  url?: string;
}

export interface SystemHealthData {
  gemini: ServiceHealth;
  github: ServiceHealth;
  database: ServiceHealth;
  executionEnv: ServiceHealth;
  sandbox: ServiceHealth;
  preview: ServiceHealth;
  deployment: ServiceHealth;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  updatedAt?: string;
  children?: FileNode[];
}

export interface DiffLine {
  type: 'unchanged' | 'addition' | 'deletion';
  originalLineNumber?: number;
  modifiedLineNumber?: number;
  content: string;
}

export interface FileDiffResult {
  filePath: string;
  additions: number;
  deletions: number;
  changes: number;
  lines: DiffLine[];
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

export interface Project {
  id: string;
  name: string;
  description: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  isCurrent: boolean;
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

export interface AuditLog {
  id: string;
  timestamp: string;
  type: 'SYSTEM' | 'SECURITY' | 'FILE' | 'TERMINAL' | 'AGENT';
  message: string;
  user: string;
  details?: Record<string, any>;
}

export interface DbData {
  version: string;
  currentUser: User;
  projects: Project[];
  tasks: AgentTask[];
  conversations: Conversation[];
  terminalHistory: TerminalEntry[];
  auditLogs: AuditLog[];
}
