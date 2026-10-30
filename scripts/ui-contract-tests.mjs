import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, sidebar, creative, header, styles] = await Promise.all([
  readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/shell/WorkspaceSidebar.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/creative/CreativeStudioView.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/Header.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/index.css', import.meta.url), 'utf8'),
]);

assert.match(app, /if\s*\(!res\.ok\)/, 'Studio requests must reject non-2xx responses');
assert.match(app, /status:\s*'error'/, 'Studio request failures must be represented as errors');
assert.doesNotMatch(app, /Visual adjustments and components updated successfully/, 'Failed requests must never be reported as successful');
assert.doesNotMatch(app, /تم تطبيق التعديلات البصرية، تعديل المكونات، وتحديث المعاينة بنجاح/, 'Arabic failure fallback must not claim success');

for (const section of ['home', 'studio', 'workspace', 'lab', 'creative', 'projects', 'integrations', 'release', 'settings']) {
  assert.ok(sidebar.includes("id: '" + section + "'"), 'Missing navigation section: ' + section);
}
for (const tool of ['mockups', 'ads', 'motion', 'brand', '3d']) {
  assert.ok(creative.includes("id: '" + tool + "'"), 'Missing creative destination: ' + tool);
}
assert.match(creative, /generation and export engine has not been connected yet/i, 'Creative Studio must disclose unavailable generation engines');
assert.match(creative, /لم يتم ربطه بعد/, 'Arabic creative status must disclose missing integration');
assert.doesNotMatch(header, /Database Persistence/, 'Do not display an unconditional fake database health badge');
assert.match(styles, /prefers-reduced-motion/, 'Motion must respect reduced-motion preferences');

process.stdout.write('FORGEX UI contract tests passed.\n');