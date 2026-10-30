import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(process.env.FORGEX_WORKSPACE_ROOT || process.cwd());
const MAX_BUFFER = 12 * 1024 * 1024;
const TIMEOUT = 60_000;

const PROTECTED_FILES = new Set([
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
  '.npmrc',
  '.env',
  '.env.local',
  'Dockerfile',
  'docker-compose.yml',
  'vite.config.ts',
  'tsconfig.json',
]);

export function normalizeProposedPath(filePath: string): string {
  const normalizedInput = String(filePath || '').replaceAll('\\', '/').trim();
  if (!normalizedInput || normalizedInput.startsWith('/')) {
    throw new Error(`Unsafe proposed path: ${filePath}`);
  }
  const normalized = path.posix.normalize(normalizedInput).replace(/^\.\//, '');
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error(`Unsafe proposed path: ${filePath}`);
  }
  return normalized;
}

export function isProtectedInfrastructurePath(filePath: string): boolean {
  const normalized = normalizeProposedPath(filePath);
  return PROTECTED_FILES.has(normalized) || normalized.startsWith('.github/') || normalized.startsWith('.git/');
}

function assertCommand(command: string): void {
  if (/[;&|`$(){}<>\n\r]/.test(command)) throw new Error('Sandbox rejected shell composition.');
  if (/\b(docker|podman|kubectl|curl|wget|ssh|scp|sudo|su|chmod|chown|mount|umount|kill|pkill|dd|mkfs|shutdown|reboot)\b/i.test(command)) throw new Error('Sandbox rejected privileged/network command.');
}

function argvFor(command: string): { file: string; args: string[] } {
  assertCommand(command);
  const parts = command.trim().split(/\s+/);
  const [head, ...args] = parts;
  if (head === 'pwd') return { file: '/bin/pwd', args: [] };
  if (head === 'node' && args[0] === '--version') return { file: process.execPath, args: ['--version'] };
  if (head === 'npm' && ['test', '--version'].includes(args[0])) return { file: 'npm', args };
  if (head === 'npm' && args[0] === 'run' && ['lint', 'build', 'verify', 'test', 'check'].includes(args[1])) return { file: 'npm', args };
  if (head === 'npx' && args[0] === 'vite' && args[1] === 'build') return { file: 'npx', args };
  if (head === 'npx' && args[0] === 'tsc' && (args[1] === '--noEmit' || args.length === 1)) return { file: 'npx', args };
  if (head === 'git' && ['status', 'diff', 'log', 'branch', 'show'].includes(args[0])) return { file: 'git', args };
  if (/^(ls|find|cat|head|tail|grep|rg|printf|echo)$/.test(head)) {
    const pathArgs = head === 'grep' || head === 'rg' ? args.slice(1) : args;
    for (const arg of pathArgs) {
      if (!arg || arg.startsWith('-')) continue;
      const normalized = arg.replaceAll('\\', '/');
      if (normalized.startsWith('/') || normalized.split('/').includes('..')) {
        throw new Error('Sandbox rejected a path outside /workspace.');
      }
    }
    return { file: head, args };
  }
  throw new Error('Command is not permitted by the FORGEX sandbox policy.');
}

function bwrapAvailable(): boolean { return fs.existsSync('/usr/bin/bwrap') || fs.existsSync('/bin/bwrap'); }

async function run(file: string, args: string[], cwd: string, isolate: boolean) {
  const env = {
    PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
    HOME: '/tmp/forgex-home',
    NODE_ENV: 'test',
    npm_config_update_notifier: 'false',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
  };
  if (!isolate) {
    return execFileAsync(file, args, { cwd, env, timeout: TIMEOUT, maxBuffer: MAX_BUFFER });
  }
  if (!bwrapAvailable()) {
    const e: any = new Error('Isolated sandbox is unavailable: bubblewrap is not installed.');
    e.code = 'SANDBOX_UNAVAILABLE';
    throw e;
  }
  const bwrap = fs.existsSync('/usr/bin/bwrap') ? '/usr/bin/bwrap' : '/bin/bwrap';
  const command = [file, ...args].map((x) => JSON.stringify(x)).join(' ');
  const binds: string[] = ['--ro-bind', '/usr', '/usr', '--ro-bind', '/lib', '/lib'];
  if (fs.existsSync('/lib64')) binds.push('--ro-bind', '/lib64', '/lib64');
  if (fs.existsSync('/bin')) binds.push('--ro-bind', '/bin', '/bin');
  if (fs.existsSync('/etc/ssl/certs/ca-certificates.crt')) {
    binds.push('--ro-bind', '/etc/ssl/certs/ca-certificates.crt', '/etc/ssl/certs/ca-certificates.crt');
  }
  return execFileAsync(bwrap, [
    '--die-with-parent', '--new-session', '--unshare-all', '--clearenv',
    ...binds, '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp', '--dir', '/home',
    '--bind', cwd, '/workspace', '--chdir', '/workspace', '--setenv', 'HOME', '/tmp', '--setenv', 'PATH', env.PATH,
    '--setenv', 'NODE_ENV', 'test', '--', '/bin/sh', '-lc', command,
  ], { cwd: ROOT, env, timeout: TIMEOUT, maxBuffer: MAX_BUFFER });
}

export async function executeSandboxCommand(command: string, options: { requireIsolation: boolean }) {
  const { file, args } = argvFor(command);
  const mode = process.env.FORGEX_SANDBOX_MODE || (process.env.NODE_ENV === 'production' ? 'bwrap' : 'workspace');
  const isolate = mode === 'bwrap' || options.requireIsolation;
  const result = await run(file, args, ROOT, isolate);
  return { stdout: result.stdout || '', stderr: result.stderr || '', exitCode: 0 };
}

export async function verifyWorkspace(type: string) {
  const commands: Record<string, string[]> = {
    lint: ['npm run lint'], build: ['npm run build'], test: ['npm run test'], check: ['npm run lint', 'npm run test', 'npm run build'],
  };
  const selected = commands[type] || commands.lint;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), `forgex-verify-${randomBytes(4).toString('hex')}-`));
  try {
    fs.cpSync(ROOT, temp, { recursive: true, filter: (src) => {
      const rel = path.relative(ROOT, src).replaceAll(path.sep, '/');
      return !rel.startsWith('.git/') && rel !== '.git' && !rel.startsWith('dist/') && rel !== 'dist' && !rel.startsWith('.env');
    } });
    const outputs: string[] = [];
    for (const command of selected) {
      const { file, args } = argvFor(command);
      const result = await run(file, args, temp, process.env.FORGEX_SANDBOX_MODE !== 'workspace' || process.env.NODE_ENV === 'production');
      outputs.push(`$ ${command}\n${result.stdout || ''}${result.stderr || ''}`);
    }
    return { success: true, command: selected.join(' && '), stdout: outputs.join('\n'), stderr: '', exitCode: 0, durationMs: 0 };
  } catch (err: any) {
    return { success: false, command: selected.join(' && '), stdout: err?.stdout || '', stderr: err?.stderr || err?.message || 'Verification failed.', exitCode: typeof err?.code === 'number' ? err.code : 1, durationMs: 0 };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

export async function verifyProposedChanges(changes: Array<{ filePath: string; newContent: string }>, commands: string[]) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), `forgex-patch-${randomBytes(4).toString('hex')}-`));
  const started = Date.now();
  try {
    fs.cpSync(ROOT, temp, { recursive: true, filter: (src) => {
      const rel = path.relative(ROOT, src).replaceAll(path.sep, '/');
      return !rel.startsWith('.git/') && rel !== '.git' && !rel.startsWith('dist/') && rel !== 'dist' && !rel.startsWith('.env');
    } });
    for (const change of changes) {
      const normalized = normalizeProposedPath(change.filePath);
      if (isProtectedInfrastructurePath(normalized)) {
        throw new Error(`Protected infrastructure file requires explicit manual review: ${normalized}`);
      }
      const target = path.resolve(temp, normalized);
      if (!target.startsWith(`${temp}${path.sep}`) && target !== temp) throw new Error(`Unsafe proposed path: ${change.filePath}`);
      let cursor = target;
      while (cursor !== temp && !fs.existsSync(cursor)) cursor = path.dirname(cursor);
      const realTemp = fs.realpathSync(temp);
      const realCursor = fs.realpathSync(cursor);
      if (realCursor !== realTemp && !realCursor.startsWith(`${realTemp}${path.sep}`)) {
        throw new Error(`Unsafe proposed path resolves outside disposable workspace: ${change.filePath}`);
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, change.newContent, 'utf8');
    }
    const outputs: string[] = [];
    for (const command of commands) {
      const { file, args } = argvFor(command);
      const result = await run(file, args, temp, true);
      outputs.push(`$ ${command}\n${result.stdout || ''}${result.stderr || ''}`);
    }
    return { success: true, command: commands.join(' && '), stdout: outputs.join('\n'), stderr: '', exitCode: 0, durationMs: Date.now() - started };
  } catch (err: any) {
    return { success: false, command: commands.join(' && '), stdout: err?.stdout || '', stderr: err?.stderr || err?.message || 'Verification failed.', exitCode: typeof err?.code === 'number' ? err.code : 1, durationMs: Date.now() - started };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
