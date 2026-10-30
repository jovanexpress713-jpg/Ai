import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectProject } from '../server/lab/project-detect.ts';

function fixture(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgex-detect-'));
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

try {
  {
    const root = fixture({ 'package.json': JSON.stringify({ name: 'web', scripts: { build: 'vite build', test: 'vitest' }, dependencies: { react: '^19', vite: '^8' } }), 'package-lock.json': '{}' });
    const profile = detectProject(root);
    assert.equal(profile.projectType, 'web');
    assert.equal(profile.language, 'javascript');
    assert.equal(profile.framework, 'react-vite');
    assert.equal(profile.packageManager, 'npm');
    assert.deepEqual(profile.scripts, ['build', 'test']);
    assert.ok(profile.platforms.includes('web'));
    fs.rmSync(root, { recursive: true, force: true });
  }
  {
    const root = fixture({ 'package.json': JSON.stringify({ name: 'api', scripts: { start: 'node server.js' }, dependencies: { express: '^4' } }) });
    const profile = detectProject(root);
    assert.equal(profile.projectType, 'backend');
    assert.equal(profile.framework, 'node-express');
    fs.rmSync(root, { recursive: true, force: true });
  }
  {
    const root = fixture({ 'pubspec.yaml': 'name: mobile_app\ndependencies:\n  flutter:\n    sdk: flutter\n', 'lib/main.dart': 'void main() {}' });
    const profile = detectProject(root);
    assert.equal(profile.projectType, 'mobile');
    assert.equal(profile.language, 'dart');
    assert.equal(profile.framework, 'flutter');
    assert.ok(profile.platforms.includes('android'));
    fs.rmSync(root, { recursive: true, force: true });
  }
  {
    const root = fixture({ 'settings.gradle': 'rootProject.name = "AndroidApp"', 'app/build.gradle': 'plugins { id "com.android.application" }' });
    const profile = detectProject(root);
    assert.equal(profile.projectType, 'mobile');
    assert.equal(profile.framework, 'android-gradle');
    assert.ok(profile.platforms.includes('android'));
    fs.rmSync(root, { recursive: true, force: true });
  }
  {
    const root = fixture({ 'MyApp.csproj': '<Project Sdk="Microsoft.NET.Sdk"></Project>' });
    const profile = detectProject(root);
    assert.equal(profile.language, 'csharp');
    assert.equal(profile.framework, 'dotnet');
    assert.ok(profile.platforms.includes('windows'));
    fs.rmSync(root, { recursive: true, force: true });
  }
  {
    const root = fixture({ 'README.md': 'unknown source tree' });
    const profile = detectProject(root);
    assert.equal(profile.projectType, 'unknown');
    assert.equal(profile.framework, 'unknown');
    fs.rmSync(root, { recursive: true, force: true });
  }
  {
    const root = fixture({ 'README.md': 'safe' });
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'forgex-outside-'));
    fs.symlinkSync(outside, path.join(root, 'escape'), 'dir');
    assert.throws(() => detectProject(path.join(root, 'escape')), /outside|workspace|root/i);
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
} finally {
  // Each fixture is removed in its own block.
}

console.log('Project detection tests: PASS');