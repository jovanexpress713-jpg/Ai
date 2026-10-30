import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { LabExecutableCheck, LabExecutionResult, LabExecutionRun } from './types.ts';

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 200_000;
const ALLOWED_CHECKS = new Set<LabExecutableCheck>(['build', 'test']);

export interface LabExecutionOptions {
  timeoutMs?: number;
  maxOutputBytes?: number;
}

function assertWorkspaceRoot(root: string): string {
  const resolved = path.resolve(root);
  if (!fs.existsSync(resolved)) throw new Error('Workspace root does not exist.');
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory()) throw new Error('Workspace root must be a directory.');
  if (stat.isSymbolicLink()) throw new Error('Workspace root cannot be a symbolic link.');
  return resolved;
}

function readScripts(root: string): Record<string, unknown> {
  const packagePath = path.join(root, 'package.json');
  if (!fs.existsSync(packagePath)) return {};
  const parsed = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { scripts?: unknown };
  return parsed.scripts && typeof parsed.scripts === 'object' ? parsed.scripts as Record<string, unknown> : {};
}

function safeEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR,
    LANG: process.env.LANG,
    LC_ALL: process.env.LC_ALL,
    CI: '1',
    NODE_ENV: process.env.NODE_ENV || 'test',
  };
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('FORGEX_')) env[key] = value;
  }
  return env;
}

function appendOutput(current: string, chunk: Buffer, maxBytes: number): string {
  if (Buffer.byteLength(current) >= maxBytes) return current;
  const remaining = maxBytes - Buffer.byteLength(current);
  return current + chunk.toString('utf8').slice(0, remaining);
}

function runScript(root: string, check: LabExecutableCheck, script: string, options: Required<LabExecutionOptions>): Promise<LabExecutionResult> {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = ['run', check];
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: safeEnvironment(),
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 2_000).unref();
    }, options.timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => { stdout = appendOutput(stdout, chunk, options.maxOutputBytes); });
    child.stderr.on('data', (chunk: Buffer) => { stderr = appendOutput(stderr, chunk, options.maxOutputBytes); });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const status = timedOut ? 'TIMEOUT' : exitCode === 0 ? 'PASSED' : 'FAILED';
      resolve({
        check,
        status,
        command: `${command} ${args.join(' ')}`,
        exitCode,
        signal,
        durationMs: Date.now() - started,
        stdout,
        stderr,
        timedOut,
      });
    });

    void script;
  });
}

export async function executeLabChecks(root: string, checks: LabExecutableCheck[], options: LabExecutionOptions = {}): Promise<LabExecutionRun> {
  const workspace = assertWorkspaceRoot(root);
  const timeoutMs = Math.max(1_000, Math.min(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 10 * 60_000));
  const maxOutputBytes = Math.max(1_024, Math.min(options.maxOutputBytes ?? MAX_OUTPUT_BYTES, MAX_OUTPUT_BYTES));
  const scripts = readScripts(workspace);

  for (const check of checks) {
    if (!ALLOWED_CHECKS.has(check)) throw new Error(`Unsupported Lab check: ${String(check)}`);
  }

  const startedAt = new Date().toISOString();
  const results: LabExecutionResult[] = [];
  for (const check of checks) {
    const script = scripts[check];
    if (typeof script !== 'string' || script.trim() === '') {
      results.push({ check, status: 'BLOCKED', command: '', exitCode: null, signal: null, durationMs: 0, stdout: '', stderr: `${check} script is not declared in package.json.`, timedOut: false });
      continue;
    }
    results.push(await runScript(workspace, check, script, { timeoutMs, maxOutputBytes }));
  }

  return { startedAt, finishedAt: new Date().toISOString(), results };
}
