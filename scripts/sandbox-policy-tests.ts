import assert from 'node:assert/strict';
import { normalizeProposedPath, isProtectedInfrastructurePath } from '../server/sandbox.ts';

assert.equal(normalizeProposedPath('./src/App.tsx'), 'src/App.tsx');
assert.equal(normalizeProposedPath('src\\App.tsx'), 'src/App.tsx');
assert.throws(() => normalizeProposedPath('../package.json'), /Unsafe proposed path/);
assert.throws(() => normalizeProposedPath('/etc/passwd'), /Unsafe proposed path/);
assert.equal(isProtectedInfrastructurePath('package.json'), true);
assert.equal(isProtectedInfrastructurePath('./package.json'), true);
assert.equal(isProtectedInfrastructurePath('.github/workflows/ci.yml'), true);
assert.equal(isProtectedInfrastructurePath('src/App.tsx'), false);

console.log('Sandbox policy tests: PASS');
