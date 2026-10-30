import fs from 'node:fs';
import path from 'node:path';
import type { ProjectLabRun } from './types.ts';

const DEFAULT_STORE = path.resolve(process.env.FORGEX_LAB_RUNS_PATH || path.join(process.cwd(), 'data', 'lab_runs.json'));
const MAX_RUNS = 100;

export function loadLabRuns(filePath = DEFAULT_STORE): ProjectLabRun[] {
  if (!fs.existsSync(filePath)) return [];
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error('Project Lab run store is corrupt: expected an array.');
  return parsed.slice(0, MAX_RUNS) as ProjectLabRun[];
}

export function saveLabRun(run: ProjectLabRun, filePath = DEFAULT_STORE): void {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  const runs = loadLabRuns(filePath).filter((item) => item.id !== run.id);
  runs.unshift(run);
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(runs.slice(0, MAX_RUNS), null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporary, filePath);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}
