import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { detectProject } from './project-detect.ts';
import type { LabCheck, ProjectLabRun } from './types.ts';

function isRegularFile(root: string, relative: string): boolean {
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, relative);
  if (!target.startsWith(absoluteRoot + path.sep)) return false;
  try {
    const stat = fs.lstatSync(target);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

export function inspectProject(root: string): ProjectLabRun {
  const detected = detectProject(root);
  const profile = { ...detected, root: '.' };
  const checks: LabCheck[] = [];
  const invalidManifest = detected.warnings.some((warning) => /not valid JSON/i.test(warning));
  checks.push({
    id: 'manifest-readable',
    label: 'Project manifest inspection',
    category: 'static',
    status: invalidManifest ? 'FAILED' : detected.manifests.length ? 'PASSED' : 'BLOCKED',
    detail: invalidManifest
      ? 'A project manifest exists but could not be parsed.'
      : detected.manifests.length
        ? `Read ${detected.manifests.length} supported manifest file(s) without executing project code.`
        : 'No supported project manifest was detected.',
  });

  if (detected.framework === 'react-vite') {
    const entrypointFound = isRegularFile(detected.root, 'index.html') &&
      ['src/main.tsx', 'src/main.jsx', 'src/index.tsx', 'src/index.jsx'].some((file) => isRegularFile(detected.root, file));
    checks.push({
      id: 'web-entrypoint',
      label: 'Web application entry point',
      category: 'static',
      status: entrypointFound ? 'PASSED' : 'FAILED',
      detail: entrypointFound ? 'Vite HTML and React entry files are present.' : 'Expected index.html and a React src entry file were not both found.',
    });
  }

  if (detected.scripts.includes('build')) {
    checks.push({ id: 'build-script-declared', label: 'Build script declaration', category: 'static', status: 'PASSED', detail: 'A build script is declared in package.json; it has not been executed.' });
  } else {
    checks.push({ id: 'build-script-declared', label: 'Build script declaration', category: 'static', status: 'BLOCKED', detail: 'No package.json build script was detected.' });
  }

  if (detected.scripts.includes('test')) {
    checks.push({ id: 'test-script-declared', label: 'Test script declaration', category: 'static', status: 'PASSED', detail: 'A test script is declared in package.json; it has not been executed.' });
  } else {
    checks.push({ id: 'test-script-declared', label: 'Test script declaration', category: 'static', status: 'BLOCKED', detail: 'No package.json test script was detected.' });
  }

  checks.push({
    id: 'build-execution',
    label: 'Build execution',
    category: 'execution',
    status: 'NOT_RUN',
    detail: 'Not run: isolated project execution is not connected yet.',
  });
  checks.push({
    id: 'test-execution',
    label: 'Automated test execution',
    category: 'execution',
    status: 'NOT_RUN',
    detail: 'Not run: isolated project execution is not connected yet.',
  });

  return {
    id: `lab_${randomUUID()}`,
    projectRoot: '.',
    profile,
    status: 'INSPECTED',
    checks,
    commandsExecuted: [],
    createdAt: new Date().toISOString(),
  };
}
