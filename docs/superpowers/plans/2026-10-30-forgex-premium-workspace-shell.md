# FORGEX Premium Workspace Shell and Creative Studio Implementation Plan

> **For agentic workers:** Execute this plan task-by-task on the feature branch. Steps use checkbox syntax for tracking.

**Goal:** Replace the cramped developer-dashboard presentation with a premium, responsive command workspace and add an honest Creative Studio entry point while preserving existing engineering flows.

**Architecture:** Keep App.tsx as the state owner for the first incremental milestone. Add focused navigation and creative landing components, style them with the existing Tailwind/Motion stack, and preserve the current engineering workspace behind its existing view state. No new dependency is required.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind CSS 4, Motion 12, lucide-react, Node test scripts.

**Spec:** docs/superpowers/specs/2026-10-30-forgex-command-workspace-and-creative-studio-design.md

## Global Constraints

- Arabic RTL is the primary language; English remains LTR.
- Do not add fake metrics, fake integrations, or fake generation results.
- Do not report a failed API request as successful.
- Preserve existing authentication, RBAC, sandbox, approval, rollback, and audit flows.
- Owner development access does not override third-party billing, quotas, or credentials.
- No new runtime dependency for this milestone.

## Review Focus

- API request fails or returns non-2xx: show an explicit error and do not claim success.
- Browser refresh while a new view is selected: navigation must remain deterministic; local-only selection may reset unless persisted intentionally.
- Arabic/English switch: direction and alignment must update without reversing semantic icon meaning.
- Narrow viewport: navigation must collapse without hiding the active work surface.
- Creative tool is not yet connected: show a clear unavailable/integration-required state, never a fake render button.

---

### Task 1: Correct studio request status handling

**Files:**
- Modify: src/App.tsx
- Test: scripts/ui-contract-tests.mjs

**Interfaces:**
- Existing handleSendStudio remains the submission entry point.
- UI contract test reads source to ensure the catch path cannot append a success status.

- [ ] Add a failing source-contract test asserting that failed studio requests append error status and never use the success fallback copy.
- [ ] Run node scripts/ui-contract-tests.mjs and confirm the expected failure.
- [ ] Update handleSendStudio to check response.ok, parse safe error details, set status to error on failures, and avoid incrementing the preview key on failure.
- [ ] Run the test and confirm it passes.

### Task 2: Add premium workspace navigation

**Files:**
- Create: src/components/shell/WorkspaceSidebar.tsx
- Create: src/components/shell/WorkspaceTopbar.tsx
- Modify: src/App.tsx
- Modify: src/index.css
- Test: scripts/ui-contract-tests.mjs

**Interfaces:**
- WorkspaceSidebar receives activeSection, language, onNavigate, and collapsed state; it emits a typed section key.
- WorkspaceTopbar receives language, theme, onThemeChange, health, and onOpenHealth.
- App owns active section and theme state; existing studio/home/workspace state remains the engineering view selector.

- [ ] Extend the contract test to assert every primary destination has a stable section key and navigation callback.
- [ ] Run the test and confirm the new assertions fail.
- [ ] Implement a slim expandable sidebar with Overview, AI Workspace, Engineering, Project Lab, Creative Studio, Projects, Integrations, Release Center, and Settings.
- [ ] Implement a compact topbar with brand, current section, language/theme controls, and actual health modal action.
- [ ] Connect Engineering and AI Workspace destinations to existing views; route other not-yet-built destinations to truthful capability pages.
- [ ] Apply RTL/LTR direction and responsive mobile navigation.
- [ ] Run the contract test and inspect all navigation destinations.

### Task 3: Build the Creative Studio landing surface

**Files:**
- Create: src/components/creative/CreativeStudioView.tsx
- Modify: src/App.tsx
- Modify: src/index.css
- Test: scripts/ui-contract-tests.mjs

**Interfaces:**
- CreativeStudioView receives language and selectedTool; tool cards navigate among Mockups, Advertising, Motion & Video, Brand Identity, and 3D Assets.
- Each tool surface shows capability state, required integration, and next action; no generation is simulated.

- [ ] Add failing tests for the five creative destinations and explicit unavailable/connection-required states.
- [ ] Run the tests and confirm they fail before implementation.
- [ ] Implement a large editorial hero and spacious visual tool cards with CSS-generated abstract previews, not remote stock dependencies.
- [ ] Add clear status labels for tools that require provider/renderer integration.
- [ ] Connect Creative Studio navigation from the shell.
- [ ] Run the tests and verify Arabic and English labels.

### Task 4: Theme, motion, and responsive polish

**Files:**
- Modify: src/App.tsx
- Modify: src/index.css
- Modify: src/components/shell/WorkspaceSidebar.tsx
- Modify: src/components/shell/WorkspaceTopbar.tsx
- Modify: src/components/creative/CreativeStudioView.tsx

- [ ] Add persisted light/dark theme preference using localStorage only for UI preference, never secrets.
- [ ] Add reduced-motion-aware transitions and visible focus styles.
- [ ] Verify sidebar collapse, central workspace width, and creative cards at mobile/tablet/desktop breakpoints.
- [ ] Verify Arabic RTL and English LTR.

### Task 5: Full verification and delivery

**Files:**
- Modify: README.md
- Verify: package scripts and CI workflow

- [ ] Run npm run lint.
- [ ] Run npm run test.
- [ ] Run npm run smoke.
- [ ] Run npm run build.
- [ ] Run npm run check and inspect the complete output.
- [ ] Verify Git diff and confirm no unrelated files or secrets changed.
- [ ] Report the exact commit and test evidence; leave the feature branch isolated from main until reviewed.