import type { ProjectProfile } from './project-detect.ts';

export type LabCheckStatus = 'PASSED' | 'FAILED' | 'BLOCKED' | 'NOT_RUN';
export type LabExecutionStatus = 'PASSED' | 'FAILED' | 'BLOCKED' | 'TIMEOUT';
export type LabExecutableCheck = 'build' | 'test';

export interface LabCheck {
  id: string;
  label: string;
  category: 'static' | 'execution';
  status: LabCheckStatus;
  detail: string;
}

export interface LabExecutionResult {
  check: LabExecutableCheck;
  status: LabExecutionStatus;
  command: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface LabExecutionRun {
  startedAt: string;
  finishedAt: string;
  results: LabExecutionResult[];
}

export interface ProjectLabRun {
  id: string;
  projectRoot: string;
  profile: ProjectProfile;
  status: 'INSPECTED' | 'EXECUTED';
  checks: LabCheck[];
  commandsExecuted: string[];
  execution?: LabExecutionRun;
  createdAt: string;
}
