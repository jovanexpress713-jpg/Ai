# FORGEX AI Multi-Provider Routing Design

**Status:** Expanded proposal awaiting owner approval; provider-routing approach selected.
**Date:** 2026-10-30

## Intent

Evolve FORGEX AI from a Gemini-only autonomous engineering workflow into a hybrid, cost-aware workspace that can use multiple cloud and local model providers without locking the product to one gateway. The same autonomous engineering cycle must use the selected provider; adding provider settings without routing real tasks is not sufficient.

## Goals

- Keep Gemini as the first-class existing provider while adding direct adapters for Anthropic Claude, OpenAI, and Ollama.
- Support OpenRouter as an optional OpenAI-compatible gateway.
- Normalize text generation, JSON-oriented responses, connection diagnostics, latency, and safe error categories behind one provider contract.
- Route engineering tasks using explicit provider configuration, task category, provider availability, and a low-cost policy.
- Keep secrets in environment variables only; never return or log secret values.
- Report configured and connected states accurately. A configured key is not proof of a live connection.
- Preserve current authentication, RBAC, approval-before-apply, isolated verification, atomic apply, and rollback protections.
- Keep the existing app runnable with only Gemini configured; other providers remain optional.
- Add deterministic tests that do not require live credentials, and runtime smoke coverage for the unconfigured state.

## Non-goals for this phase

- No claim of autonomous multi-agent orchestration merely from role labels.
- No automatic multi-model fan-out, which would multiply token costs.
- No storing API keys in the JSON database or browser storage.
- No arbitrary tool execution, shell permission expansion, or bypass of existing apply approvals.
- Image generation, voice, embeddings, vector databases, and arbitrary third-party MCP execution are separate capabilities; do not simulate them in this release.
- No promise that a provider, emulator, device, repository operation, or build is connected or successful unless it was actually exercised.
- No automatic destructive repair or release signing without explicit policy and approval.

## Constraints

- Operating mode: hybrid cloud + local models.
- Product scope: web, mobile, Windows, accounting/business systems, and design engineering tasks.
- Cost posture: low; choose a low-cost configured model by default and escalate only when policy or an explicit user override requests it.
- Existing stack: TypeScript, Node.js 22, Express, Vite, `@google/genai`, native Fetch.
- No new SDK dependency is required for the first adapters: use the existing Gemini SDK and documented HTTP APIs for Anthropic and OpenAI-compatible providers.
- Provider API keys are environment-only. Never ask the user to paste secrets into chat.
- Local Ollama connectivity requires an Ollama service reachable from the FORGEX server process; localhost inside a container means the container, not the user's phone or host.

## Approaches considered

1. **Direct provider adapters plus independent router — selected.** Avoids vendor lock-in, allows task/cost-aware selection, and keeps local Ollama possible. Costs more engineering effort but best matches hybrid operation.
2. **One gateway for every model.** Faster initial integration but creates a single dependency and does not make local Ollama routing natural.
3. **Independent integrations with no router.** Simple initially but leaves every feature responsible for provider selection and fallback, increasing maintenance and inconsistent cost behavior.

## Architecture

### Provider contract

Create a provider registry with typed provider IDs and normalized operations:

- `getProviderStatus(providerId)`: reports `NOT_CONFIGURED`, `CONFIGURED_UNTESTED`, `CONNECTED`, `AUTH_ERROR`, `RATE_LIMITED`, or `UNAVAILABLE`.
- `testProviderConnection(providerId)`: makes a bounded real request and returns status, selected model, latency, and a sanitized error. It never returns credentials.
- `generateText(request)`: accepts a task category, system prompt, prompt, optional explicit model, and output mode; returns text, provider/model identifiers, latency, and usage when supplied by the provider.
- Provider implementations: Gemini SDK; Anthropic Messages HTTP API; OpenAI Chat Completions HTTP API; OpenRouter and Ollama through configurable OpenAI-compatible base URLs.

### Routing policy

- Respect a valid explicit provider/model override.
- Otherwise select only from configured providers that support the requested operation.
- Prefer the configured low-cost/default model for ordinary planning and implementation.
- Escalate only when explicitly requested or when policy marks the task complex and a stronger provider is configured.
- Do not retry authentication/configuration failures against other providers.
- Retry/fallback only on bounded transient failures (rate limit, timeout, network/service unavailable), and record the actual provider/model used.
- Do not silently switch a task to a provider that has not been configured.

### Autonomous workflow integration

Replace the direct Gemini call inside `runAutonomousCycle` with the router while preserving the current structured proposal format and the existing verification/apply lifecycle. Keep the task's actual provider/model in task metadata or audit details where compatible with the existing schema. Remove or quarantine the obsolete static `processAgentTask` path so no route can accidentally call it.

### API and diagnostics

- Add an authenticated, RBAC-protected provider status endpoint.
- Add an authenticated, RBAC-protected provider connection-test endpoint.
- Keep `/api/gemini/test` compatible during migration.
- Update health reporting to distinguish configured from verified-connected providers.
- Expose no secret values, partial keys, or request authorization headers.

### Security and cost

- Read secrets only from process environment.
- Bound provider request duration and response size.
- Sanitize provider errors before API responses and audit logs.
- Use a single selected provider per model call; no parallel fan-out.
- Set conservative per-call timeout and output-token limits.
- Keep local provider base URLs configurable and validate protocols/host settings to avoid accidental unsafe destinations.

## Acceptance criteria

1. Unit tests prove provider configuration detection, secret redaction, status normalization, provider selection, override behavior, and fallback restrictions.
2. Adapter tests exercise request construction and response normalization using injected fetch/transport fixtures; these are explicitly not described as live connectivity tests.
3. Runtime smoke tests show every absent provider as not configured and the agent route failing with a clear missing-provider message rather than a fake response.
4. The autonomous workflow routes through the provider abstraction and retains structured proposals and existing safety gates.
5. Existing security/auth/sandbox tests, lint, smoke tests, production build, and Docker build pass.
6. Live provider connection is reported only after a real provider ping succeeds with the relevant secret or reachable Ollama service.
7. Documentation lists exact environment variable names and clearly distinguishes deterministic adapter tests from live connection tests.

## Implementation decisions left to the builder

- Use native Fetch for Anthropic and OpenAI-compatible adapters to avoid adding multiple SDK dependencies in the low-budget foundation.
- Keep the first phase backend-focused; provider dashboard controls can be added after the APIs and status semantics are proven.
- Default routing must remain deterministic and explainable; no opaque automatic model selection.


## Expanded product definition: Engineering and Quality Workspace

FORGEX AI is intended to become an engineering workspace that can take a project from discovery and design through implementation, testing, repair, maintenance, version control, and release artifacts. The AI model is the reasoning layer; execution, test evidence, repository state, and build artifacts must come from real tools.

### Project laboratory and execution environments

Create an isolated, reproducible project environment for each project:

- Detect project type, language, package manager, frameworks, build commands, test commands, runtime requirements, and target platforms from actual project files.
- Provision only the required runtime and dependencies; cache immutable dependencies and build layers to reduce time and cost.
- Run static analysis, type checks, unit tests, integration tests, security checks, dependency checks, builds, and runtime smoke tests.
- Keep project data, secrets, and build outputs separated by project. Secrets must be injected at runtime and masked from logs.
- Produce an inspectable test report containing commands, environment versions, exit codes, timestamps, logs, screenshots, and artifact hashes.
- Distinguish PASS, FAIL, BLOCKED, NOT RUN, and NEEDS HUMAN INPUT. Never convert a skipped or unavailable test into PASS.

### Interactive web and application testing

For web applications, use a real browser automation runner (Playwright is the proposed default):

- Launch the built application and open it in a real browser engine.
- Exercise actual user journeys: navigation, forms, validation, authentication, search, CRUD, responsive layouts, keyboard interaction, and error states.
- Capture screenshots, browser console errors, failed network requests, traces, and reproducible steps.
- Check accessibility basics and responsive breakpoints.
- Allow the agent to inspect rendered pages and screenshots, propose fixes, then rerun the same failing scenario and the regression suite.

For Android applications:

- Build with the project's real Gradle/Flutter/React Native toolchain; do not fabricate an APK.
- Start an Android emulator in an isolated CI/runtime environment, install the generated APK, launch it, grant or deny permissions as scripted, and interact with visible UI and device controls.
- Use an Android UI automation layer (Maestro is the proposed low-friction default; Appium can be an optional advanced adapter) to execute repeatable user journeys.
- Collect Logcat, crash/ANR signals, screenshots/video where supported, network failures, package metadata, install/launch status, and test results.
- Test a defined Android API/device matrix based on the app's declared min/target SDK and configured product requirements.
- Physical-device testing is an optional second lane when a real device farm or connected device is available. An emulator result must be labeled emulator-tested, not physical-device-certified.
- Export APK/AAB only from a successful build. A release APK must also pass configured signing and release validation; never claim Play Store readiness from a debug build.

For Windows desktop applications:

- Detect supported build targets and run builds/tests on a Windows runner or an explicitly supported Windows VM. Do not label a Linux-only build as Windows-tested.

### Repository and source-control workspace

Provide a repository workspace with real Git semantics:

- Create/import repositories, clone and initialize projects, inspect history, branches, tags, diffs, and file status.
- Create branches, commits, tags, pull requests, and reviews through Git/GitHub APIs where credentials and permissions exist.
- Support issue/task linking, protected branch policy, merge checks, release notes, and rollback/revert workflows.
- Keep local project Git state and remote GitHub state distinguishable; report synchronization conflicts honestly.
- Never overwrite user work silently. Show diffs and require approval for destructive or protected operations.
- Do not claim to be a GitHub replacement for hosted collaboration features that are not implemented; the built-in repository is a project source-control workspace with optional GitHub synchronization.

### Maintenance and repair lifecycle

- Provide scheduled/on-demand health checks for dependencies, tests, security findings, build status, and runtime errors.
- Classify issues by severity, evidence, likely root cause, affected files, and confidence.
- Offer a repair plan with minimal diffs and explain risk; apply only within the user's permissions and approval policy.
- After a repair, rerun the failing test, relevant regression tests, and full release gate before marking it fixed.
- Track issue recurrence and maintenance history. A repair is not complete because code changed; it is complete only when verification evidence supports the result.

### Accounting and business-system engineering

Add a specialist workflow for accounting and business applications:

- Research user requirements, relevant official regulations/standards where applicable, accounting references, chart-of-accounts patterns, and domain-specific workflows using web search and trusted documentation.
- Present source links, publication/version dates when available, jurisdiction assumptions, and a distinction between verified requirements and proposed design choices.
- Ask for jurisdiction, currency, tax treatment, accounting basis, business type, and operational policies when those materially affect correctness. Never invent legal or tax requirements.
- Generate configurable chart-of-accounts proposals, account mapping, journal-entry workflows, subledgers, invoices, receipts, inventory/costing flows, reconciliation, financial statements, permissions, audit trails, and period closing as required by the brief.
- Validate accounting invariants: debits equal credits per posted journal; posted entries are immutable except through traceable reversals; subledger totals reconcile to control accounts; opening balances and carry-forward reconcile; document numbers are unique; closed periods reject unauthorized postings.
- Include scenario-based tests for cash, credit, partial payment, returns, damaged goods, refunds, debt carry-forward, supplier/customer balances, and reports when those modules are in scope.
- Provide demo fixtures only in an explicitly labeled isolated test database. Production workspaces start empty and must not contain fake financial data.

### Research and speed

- Use a research planner to break broad questions into focused searches, prioritize primary sources and official documentation, compare relevant approaches, and return source-backed findings.
- Cache source metadata and dependency artifacts with freshness controls; do not reuse stale legal, pricing, API, or version information as current.
- Parallelize independent test jobs and research queries where safe; keep dependent steps ordered.
- Use risk-based test selection during iterative edits, but require the complete configured release gate before producing a release artifact.
- Show progress based on completed work, not fabricated percentages. Report elapsed time, tests executed, tests skipped, and blockers.

## Proposed subsystem boundaries and delivery order

The product is one coherent workspace, but implementation is divided into independently testable subsystems:

1. **AI providers and router:** multiple cloud/local providers, truthful diagnostics, cost-aware selection.
2. **Project runtime and test orchestrator:** isolated project environments, test plans, logs, evidence, and report format. This is the foundation for every platform-specific lab.
3. **Interactive web testing:** browser execution, real user journeys, screenshots, console/network evidence, and regression reruns.
4. **Android build/device lab:** APK build, emulator install, interaction, crash/log collection, and artifact gate.
5. **Repository and maintenance:** Git workspace, branch/diff/review flows, health scans, repair approvals, and regression verification.
6. **Accounting engineering and research:** sourced domain research, configurable accounting design, and invariant-driven test packs.
7. **Unified workspace UI and release center:** one project view connecting source, tasks, lab results, maintenance, repository, and downloadable verified artifacts.

The first recommended implementation order is providers/router and project runtime/test orchestrator, then web and Android test adapters, then repository/maintenance and accounting packs, with the unified UI exposing only capabilities that have passed their own acceptance tests.

## Expanded acceptance criteria

1. A project cannot be marked tested unless its detected test plan records actual executed commands and results.
2. Browser tests launch the built application and capture real browser evidence.
3. Android APK delivery requires a real successful build; emulator-tested status requires installation, launch, and executed UI scenarios on an emulator.
4. Physical-device validation is labeled separately from emulator validation.
5. Failed tests remain failed until a repair is made and the failing scenario plus regression checks pass.
6. Repository operations produce real Git commits/branches/diffs and respect permissions and protected operations.
7. Accounting outputs include jurisdiction assumptions, cited research, and executable accounting-invariant tests for the implemented scope.
8. Financial production databases contain no seeded demo transactions or invented customer/supplier records.
9. Release artifacts include build metadata, test report, environment details, and a cryptographic hash.
10. Any blocked capability (missing SDK, emulator image, signing key, API key, license, Windows runner, or device) is clearly reported as BLOCKED rather than passed.
