import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { executeLabChecks } from '../server/lab/executor.ts';

function fixture(packageJson: object): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgex-exec-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(packageJson));
  return root;
}

async function main() {
  const passing = fixture({ name: 'passing', scripts: { build: 'node -e "process.stdout.write(\'BUILD_OK\')"', test: 'node -e "process.stdout.write(\'TEST_OK\')"' } });
  const failing = fixture({ name: 'failing', scripts: { build: 'node -e "process.exit(3)"' } });
  const missing = fixture({ name: 'missing', scripts: { lint: 'node -e "process.exit(0)"' } });
  const hanging = fixture({ name: 'hanging', scripts: { build: 'node -e "setTimeout(() => {}, 5000)"' } });

  try {
    const success = await executeLabChecks(passing, ['build', 'test'], { timeoutMs: 2000 });
    assert.equal(success.results.length, 2);
    assert.ok(success.results.every((result) => result.status === 'PASSED'));
    assert.equal(success.results[0].exitCode, 0);
    assert.match(success.results[0].stdout, /BUILD_OK/);
    assert.match(success.results[1].stdout, /TEST_OK/);

    const failed = await executeLabChecks(failing, ['build']);
    assert.equal(failed.results[0].status, 'FAILED');
    assert.equal(failed.results[0].exitCode, 3);

    const blocked = await executeLabChecks(missing, ['build', 'test']);
    assert.ok(blocked.results.every((result) => result.status === 'BLOCKED'));

    const timedOut = await executeLabChecks(hanging, ['build'], { timeoutMs: 100 });
    assert.equal(timedOut.results[0].status, 'TIMEOUT');
    assert.equal(timedOut.results[0].timedOut, true);

    await assert.rejects(() => executeLabChecks(passing, ['lint' as never]), /Unsupported Lab check/);
    await assert.rejects(() => executeLabChecks(passing, ['build; rm -rf /' as never]), /Unsupported Lab check/);
  } finally {
    for (const root of [passing, failing, missing, hanging]) fs.rmSync(root, { recursive: true, force: true });
  }

  console.log('Lab execution tests: PASS');
}

main().catch((error) => { console.error(error); process.exit(1); });
