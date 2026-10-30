# FORGEX AI Engineering Workspace Delivery Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Each subsystem is independently testable; execute in the listed dependency order.

**Goal:** Deliver FORGEX AI as a hybrid engineering workspace that can reason, build, run, interactively test, repair, maintain, version, and release real software projects, including Android APKs and accounting systems.

**Architecture:** Keep AI providers behind direct adapters and a cost-aware router. Execute builds and tests in isolated project runtimes with platform-specific adapters that return inspectable evidence. Connect source control, maintenance, accounting research, and release artifacts through one project/task/evidence model.

**Tech Stack:** Existing TypeScript/Node 22/Express/Vite/Gemini stack; native Fetch provider adapters; Git; Docker/Bubblewrap project isolation; Playwright for browser automation; Android SDK/emulator with Maestro UI flows as proposed default; Windows CI runner for Windows targets; web research with source citations.

**Spec:** `docs/superpowers/specs/2026-10-30-forgex-multi-provider-routing-design.md`

## Global Constraints

- Hybrid cloud + local model operation; low-cost default routing; no automatic model fan-out.
- Scope includes web, Android/mobile, Windows, accounting/business systems, and design engineering.
- All project commands execute in isolated environments with bounded resources and explicit permissions.
- API keys and signing credentials are injected at runtime and never stored in source control or returned in APIs.
- A configured integration is not a verified connection; a skipped test is not a passing test.
- Android emulator-tested and physical-device-tested are separate statuses.
- Release artifacts are created only from successful builds and the configured release test gate.
- Accounting production data starts empty; all demo fixtures are isolated and explicitly labeled.
- Existing authentication, RBAC, approval, sandbox, rollback, and audit protections remain intact.

## Review Focus

- Project scripts may be malicious or destructive — test sandbox boundaries, resource limits, network policy, and approval gates.
- Test runners may hang or exhaust memory/disk — test timeouts, quotas, cancellation, and cleanup.
- Android SDK/emulator or signing material may be absent — report BLOCKED and never fabricate APK/device status.
- Browser tests may pass while API/network failures are hidden — capture console, request failures, and server logs.
- Accounting rules vary by jurisdiction and business policy — require assumptions and cited sources; never invent legal/tax treatment.

---

## Delivery sequence

### Plan A — AI provider adapters and model router

**Existing plan:** `docs/superpowers/plans/2026-10-30-forgex-provider-routing-foundation.md`

- [ ] Implement provider contracts/configuration and secret redaction.
- [ ] Implement Gemini, Anthropic, OpenAI, OpenRouter, and Ollama adapters.
- [ ] Implement deterministic low-cost routing and bounded transient fallback.
- [ ] Route the autonomous engineering cycle through the router.
- [ ] Add provider status/test APIs and smoke coverage.
- [ ] Verify lint, tests, smoke, build, and Docker.

### Plan B — Project runtime and test orchestrator (foundation for all labs)

**Progress:** Read-only project detection is implemented through `/api/lab/profile`; static inspection reports and bounded persistent history are available through `/api/lab/inspect` and `/api/lab/runs`. The Project Lab screen displays actual static checks and explicitly labels build/test execution as `NOT_RUN`. CI run 73 passed the new project detection and lab inspection tests, smoke, production build, and Docker image build. Isolated command execution, quotas, cancellation, and runtime evidence remain pending.

**Proposed files:**
- Create: `server/lab/types.ts`, `server/lab/project-detect.ts`, `server/lab/runtime.ts`, `server/lab/orchestrator.ts`, `server/lab/evidence.ts`
- Modify: `server.ts`, `server/sandbox.ts`, `server/db.ts`, `scripts/security-tests.mjs`
- Test: `scripts/lab-policy-tests.ts`, `scripts/lab-orchestrator-tests.ts`, `scripts/lab-runtime-smoke.mjs`

**Interfaces:**
- `detectProject(root): ProjectProfile` identifies real project manifests, language, framework, package manager, scripts, and target platforms.
- `createLabRun(projectId, plan): LabRun` records a persistent run with queued/running/passed/failed/blocked/cancelled state.
- `executeLabStep(runId, step): LabStepResult` runs one allowlisted command in a disposable sandbox with timeout/resource limits.
- `finalizeLabRun(runId): LabReport` stores command evidence, logs, environment metadata, and artifact hashes.

- [x] Test project detection for Vite/React, Node API, Flutter, Android Gradle, .NET, and unknown projects.
- [ ] Test rejection of path traversal, secret file reads, unapproved network access, command injection, and resource-limit violations.
- [ ] Test timeout, cancellation, failed cleanup, and process termination.
- [ ] Implement isolated execution and persistent lab evidence; do not reuse the production server's unrestricted process. (Static inspection history is implemented; execution evidence remains pending.)
- [ ] Add authenticated/RBAC-protected APIs for plan, run, cancel, and retrieve report.
- [ ] Verify test statuses distinguish PASS, FAIL, BLOCKED, NOT RUN, and NEEDS HUMAN INPUT.
- [ ] Run existing security/auth/sandbox tests plus new lab tests.

### Plan C — Interactive web application testing

**Proposed files:**
- Create: `server/lab/adapters/playwright.ts`, `server/lab/web-journeys.ts`, `scripts/web-lab-tests.ts`
- Modify: `package.json`, `.github/workflows/ci.yml`, lab report schema

**Interfaces:**
- `runWebJourney(runId, journey): BrowserEvidence` launches the built app and executes browser interactions.
- Evidence includes browser/version, viewport, route, screenshots, trace, console errors, failed requests, and step-level results.

- [ ] Add Playwright with pinned browser/runtime versions and cached browser installation.
- [ ] Test navigation, form validation, auth/session flow, CRUD, responsive breakpoints, and accessibility smoke checks against a fixture app.
- [ ] Test console error and failed-network-request capture.
- [ ] Add safe project URL allowlisting and prevent tests from navigating to arbitrary internal/private network destinations.
- [ ] Implement evidence capture and link it to the parent LabRun.
- [ ] Verify repeatability and cleanup in CI.

### Plan D — Android build and emulator/device testing

**Proposed files:**
- Create: `server/lab/adapters/android.ts`, `server/lab/android-device.ts`, `server/lab/android-artifacts.ts`, `scripts/android-lab-tests.mjs`
- Modify: `.github/workflows/ci.yml`, lab report schema, artifact retention policy

**Interfaces:**
- `buildAndroidArtifact(projectRoot, target): AndroidBuildResult` runs the project's real Gradle/Flutter build and returns the exact artifact path, package ID, version, SDK metadata, and hash.
- `installAndRunOnEmulator(apk, deviceProfile, journeys): AndroidEvidence` installs and launches on an emulator, executes UI flows, and captures Logcat/screenshots/crash data.
- `publishVerifiedArtifact(result, report): ArtifactRecord` publishes only when the required release gate passes.

- [ ] Detect Android Gradle and Flutter projects and validate required SDK/toolchain versions.
- [ ] Add a CI emulator lane with a pinned Android system image and API/device profile.
- [ ] Test install failure, launch failure, permission flows, UI navigation, process crash, ANR, and log collection.
- [ ] Implement Maestro journeys for core user flows; leave Appium as an optional future adapter.
- [ ] Verify APK package metadata, artifact hash, and build provenance.
- [ ] Separate debug APK from signed release APK/AAB; missing signing keys must mark release signing BLOCKED.
- [ ] Label emulator tests explicitly; add physical-device lane only when an actual device/device farm is connected.
- [ ] Verify artifact is downloadable only after all configured release gates pass.

### Plan E — Repository workspace and maintenance

**Proposed files:**
- Create: `server/repository/git-service.ts`, `server/repository/branch-policy.ts`, `server/maintenance/scanner.ts`, `server/maintenance/repair.ts`
- Modify: `server/legacy-routes.ts`, `server/db.ts`, existing repository UI
- Test: `scripts/repository-policy-tests.ts`, `scripts/maintenance-tests.ts`

**Interfaces:**
- `getRepositoryState(root): RepositoryState` returns real Git status, branches, tags, history, and remote sync state.
- `createBranch/commit/revert` execute guarded Git operations and return real commit hashes.
- `scanProject(projectId): MaintenanceReport` runs configured dependency/security/test/health checks.
- `proposeRepair(reportId): RepairProposal` produces a minimal reviewable diff; apply requires permission and approval, followed by regression tests.

- [ ] Test branch creation, dirty working tree, merge conflicts, protected branch, and remote unavailable cases.
- [ ] Test secret redaction and prevent destructive Git operations without explicit approval.
- [ ] Implement real local Git workspace operations and optional GitHub sync using configured credentials.
- [ ] Implement maintenance scans with severity, evidence, affected files, and recurrence tracking.
- [ ] Implement repair approval, diff review, rollback, and required retesting.
- [ ] Verify no UI state claims a remote push/PR exists unless GitHub confirms it.

### Plan F — Accounting engineering and research

**Proposed files:**
- Create: `server/accounting/research.ts`, `server/accounting/requirements.ts`, `server/accounting/chart-of-accounts.ts`, `server/accounting/invariants.ts`, `server/accounting/scenario-packs.ts`
- Test: `scripts/accounting-invariant-tests.ts`, `scripts/accounting-scenario-tests.ts`

**Interfaces:**
- `buildAccountingResearchBrief(requirements): ResearchBrief` returns source-backed references, jurisdiction assumptions, dates, and unresolved questions.
- `proposeChartOfAccounts(requirements, references): ChartProposal` creates a configurable proposal, never a hard-coded universal legal chart.
- `validateLedger(dataset, policy): AccountingValidationReport` checks double-entry, subledger reconciliation, period controls, and document integrity.
- `runAccountingScenarios(spec): AccountingScenarioReport` tests the selected business workflows.

- [ ] Test debit/credit equality, partial settlement, debt carry-forward, returns, damage, refunds, and customer/supplier reconciliation.
- [ ] Test period closing, reversal-only corrections, unique document numbering, and role restrictions.
- [ ] Implement research briefs with primary-source preference, links, freshness metadata, and clear jurisdiction caveats.
- [ ] Implement configurable chart/account mapping and scenario packs from approved requirements.
- [ ] Ensure production database initialization has no demo customer, supplier, invoice, or transaction records.
- [ ] Verify report totals reconcile to ledger and subledgers.

### Plan G — Unified workspace and release center

**Proposed files:**
- Modify: existing dashboard components and routes after backend contracts stabilize.
- Create: project overview, test-lab panel, evidence viewer, maintenance queue, repository panel, artifact release view.

- [ ] Design a unified project workspace with Arabic RTL and English LTR support.
- [ ] Show real project profile, run history, logs, screenshots, diffs, branch status, maintenance findings, and artifact records.
- [ ] Show clear PASS/FAIL/BLOCKED/NOT RUN states with evidence links.
- [ ] Add human approval controls for apply, merge, release signing, and deployment.
- [ ] Verify UI reflects API state and cannot manufacture successful statuses.

### Final release gate

- [ ] Run all unit, integration, security, runtime, browser, and platform-specific tests available in CI.
- [ ] Run lint, production build, runtime smoke, and Docker build.
- [ ] Run Android emulator pipeline on at least one supported API profile before claiming Android emulator validation.
- [ ] Run a real web browser journey against the production build before claiming interactive web validation.
- [ ] Verify accounting invariants with non-production fixtures.
- [ ] Inspect all release artifacts, hashes, reports, and branch diff.
- [ ] Document blockers separately; never call an unavailable platform verified.
