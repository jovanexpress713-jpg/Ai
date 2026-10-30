import type { ProjectProfile } from './project-detect.ts';

export type LabCheckStatus = 'PASSED' | 'FAILED' | 'BLOCKED' | 'NOT_RUN';

export interface LabCheck {
  id: string;
  label: string;
  category: 'static' | 'execution';
  status: LabCheckStatus;
  detail: string;
}

export interface ProjectLabRun {
  id: string;
  projectRoot: string;
  profile: ProjectProfile;
  status: 'INSPECTED';
  checks: LabCheck[];
  commandsExecuted: string[];
  createdAt: string;
}
