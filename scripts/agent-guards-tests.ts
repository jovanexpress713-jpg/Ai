import assert from 'node:assert/strict';
import { validateProposedChanges } from '../server/agent-guards.ts';

const base = {
  newContent: 'updated',
  diffSummary: { additions: 1, deletions: 1, changes: 2 },
  applied: false,
};

{
  const result = validateProposedChanges([
    { ...base, filePath: 'src/App.tsx', originalContent: 'old', originalExists: true },
  ], () => ({ exists: true, content: 'old' }));
  assert.equal(result.valid, true);
}

{
  const result = validateProposedChanges([
    { ...base, filePath: 'src/App.tsx', originalContent: 'old', originalExists: true },
  ], () => ({ exists: true, content: 'newer user edit' }));
  assert.equal(result.valid, false);
  assert.match(result.error || '', /changed since the proposal/i);
}

{
  const result = validateProposedChanges([
    { ...base, filePath: 'src/New.ts', originalContent: '', originalExists: false },
  ], () => ({ exists: true, content: 'created elsewhere' }));
  assert.equal(result.valid, false);
  assert.match(result.error || '', /already exists/i);
}

{
  const result = validateProposedChanges([
    { ...base, filePath: 'src/New.ts', originalContent: '', originalExists: false },
  ], () => ({ exists: false }));
  assert.equal(result.valid, true);
}

{
  const result = validateProposedChanges([
    { ...base, filePath: 'src/App.tsx', originalContent: 'a', originalExists: true },
    { ...base, filePath: './src/App.tsx', originalContent: 'a', originalExists: true },
  ], () => ({ exists: true, content: 'a' }));
  assert.equal(result.valid, false);
  assert.match(result.error || '', /duplicate/i);
}

{
  const result = validateProposedChanges([
    { ...base, filePath: 'package.json', originalContent: '{}', originalExists: true },
  ], () => ({ exists: true, content: '{}' }));
  assert.equal(result.valid, false);
  assert.match(result.error || '', /protected/i);
}

console.log('Agent safe-apply lifecycle tests: PASS');
