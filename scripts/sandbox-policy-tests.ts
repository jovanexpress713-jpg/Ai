import assert from 'node:assert/strict';
import { normalizeProposedPath, isProtectedInfrastructurePath, requiresSandboxIsolation } from '../server/sandbox.ts';

assert.equal(normalizeProposedPath('./src/App.tsx'), 'src/App.tsx');
assert.equal(normalizeProposedPath('src\\App.tsx'), 'src/App.tsx');
assert.throws(() => normalizeProposedPath('../package.json'), /Unsafe proposed path/);
assert.throws(() => normalizeProposedPath('/etc/passwd'), /Unsafe proposed path/);
assert.equal(isProtectedInfrastructurePath('package.json'), true);
assert.equal(isProtectedInfrastructurePath('./package.json'), true);
assert.equal(isProtectedInfrastructurePath('.github/workflows/ci.yml'), true);
assert.equal(isProtectedInfrastructurePath('src/App.tsx'), false);

// Disposable workspace verification may use the restricted workspace mode in development.
// Production must always require OS-level isolation, regardless of the configured mode.
assert.equal(requiresSandboxIsolation('workspace', 'development'), false);
assert.equal(requiresSandboxIsolation(undefined, 'development'), false);
assert.equal(requiresSandboxIsolation('bwrap', 'development'), true);
assert.equal(requiresSandboxIsolation('workspace', 'production'), true);
assert.equal(requiresSandboxIsolation(undefined, 'production'), true);

console.log('Sandbox policy tests: PASS');
