import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, sidebar, creative, header, styles, lab, integrations] = await Promise.all([
  readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/shell/WorkspaceSidebar.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/creative/CreativeStudioView.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/Header.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/index.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/lab/ProjectLabView.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/integrations/AIProvidersView.tsx', import.meta.url), 'utf8'),
]);

assert.match(app, /if\s*\(!res\.ok\)/, 'Studio requests must reject non-2xx responses');
assert.match(app, /status:\s*'error'/, 'Studio request failures must be represented as errors');
assert.doesNotMatch(app, /Visual adjustments and components updated successfully/, 'Failed requests must never be reported as successful');
assert.doesNotMatch(app, /تم تطبيق التعديلات البصرية، تعديل المكونات، وتحديث المعاينة بنجاح/, 'Arabic failure fallback must not claim success');
assert.doesNotMatch(app, /Agent Online/, 'Do not show a hard-coded live agent connection');
assert.match(app, /Review the proposed changes in the workspace before applying them/, 'Successful proposal creation must not imply applied changes');
assert.match(app, /disabled[\s\S]{0,250}Preview only/, 'Illustrative code preview must not be offered as a real export');

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
assert.match(app, /currentView === 'lab' && <ProjectLabView/, 'Project Lab navigation must open the real project profile view');
assert.match(lab, /\/api\/lab\/profile/, 'Project Lab must request a real detected project profile');
assert.match(lab, /execution engine is not connected yet/i, 'Project Lab must disclose that execution is not yet available');
assert.match(app, /currentView === 'integrations' && <AIProvidersView/, 'Integrations navigation must open provider diagnostics');
assert.match(integrations, /\/api\/ai\/providers/, 'Integrations view must use the real provider status API');
assert.match(integrations, /\/test/, 'Integrations view must expose real connection tests');
assert.match(integrations, /never displayed or stored in the browser/i, 'Integrations view must explain server-only credentials');

process.stdout.write('FORGEX UI contract tests passed.\n');