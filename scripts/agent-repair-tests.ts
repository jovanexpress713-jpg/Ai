import assert from 'node:assert/strict';
import { runBoundedRepair } from '../server/agent-repair.ts';

{
  let repairs = 0;
  const result = await runBoundedRepair(
    { value: 'good' },
    async () => ({ success: true, label: 'passed' }),
    async () => { repairs += 1; return { value: 'repaired' }; },
  );
  assert.equal(result.verification.success, true);
  assert.equal(result.repairs, 0);
  assert.equal(repairs, 0);
}

{
  const result = await runBoundedRepair(
    { value: 'bad' },
    async (candidate) => ({ success: candidate.value === 'good', label: candidate.value }),
    async () => ({ value: 'good' }),
  );
  assert.equal(result.candidate.value, 'good');
  assert.equal(result.verification.success, true);
  assert.equal(result.repairs, 1);
}

{
  let calls = 0;
  const result = await runBoundedRepair(
    { value: 'bad' },
    async () => ({ success: false, label: 'failed' }),
    async () => { calls += 1; return { value: 'still-bad' }; },
    2,
  );
  assert.equal(calls, 2);
  assert.equal(result.repairs, 2);
  assert.equal(result.verification.success, false);
}

{
  const result = await runBoundedRepair(
    { value: 'bad' },
    async () => ({ success: false, label: 'failed' }),
    async () => null,
    2,
  );
  assert.equal(result.repairs, 0);
  assert.equal(result.verification.success, false);
}

console.log('Agent repair tests: PASS');
