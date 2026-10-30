import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectProject } from '../server/lab/orchestrator.ts';
import { loadLabRuns, saveLabRun } from '../server/lab/store.ts';

function fixture(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgex-lab-'));
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

const root = fixture({
  'package.json': JSON.stringify({ name: 'sample-web', scripts: { build: 'vite build', test: 'vitest run' }, dependencies: { react: '^19', vite: '^8' } }),
  'package-lock.json': '{}',
  'index.html': '<div id="root"></div>',
  'src/main.tsx': 'export {}',
});
const storage = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'forgex-lab-store-')), 'runs.json');

try {
  const run = inspectProject(root);
  assert.equal(run.status, 'INSPECTED');
  assert.equal(run.profile.framework, 'react-vite');
  assert.ok(run.checks.some((check) => check.id === 'manifest-readable' && check.status === 'PASSED'));
  assert.ok(run.checks.some((check) => check.id === 'web-entrypoint' && check.status === 'PASSED'));
  assert.ok(run.checks.some((check) => check.id === 'build-execution' && check.status === 'NOT_RUN'));
  assert.ok(run.checks.some((check) => check.id === 'test-execution' && check.status === 'NOT_RUN'));
  assert.deepEqual(run.commandsExecuted, [], 'static inspection must not execute project scripts');
  saveLabRun(run, storage);
  const saved = loadLabRuns(storage);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, run.id);
  assert.equal(saved[0].status, 'INSPECTED');

  const invalid = fixture({ 'package.json': '{broken json' });
  const invalidRun = inspectProject(invalid);
  assert.ok(invalidRun.checks.some((check) => check.id === 'manifest-readable' && check.status === 'FAILED'));
  assert.equal(invalidRun.commandsExecuted.length, 0);
  fs.rmSync(invalid, { recursive: true, force: true });
} finally {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(path.dirname(storage), { recursive: true, force: true });
}

console.log('Project Lab inspection tests: PASS');