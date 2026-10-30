# FORGEX AI Provider Routing Foundation Implementation Plan

**Implementation status:** Complete on `feat/provider-routing-foundation`. CI evidence: provider-routing build/test/smoke/Docker run 51 passed; task-preference and project-lab UI contract suite is being re-verified on the latest branch head.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add direct Gemini, Claude, OpenAI, OpenRouter, and Ollama provider adapters plus a cost-aware router, then route FORGEX autonomous engineering tasks through it.

**Architecture:** A typed provider registry normalizes diagnostics and text generation. A deterministic router selects one configured provider per call, with bounded transient fallback and no credential leakage. Existing approval, sandbox verification, atomic apply, and rollback remain unchanged.

**Tech Stack:** TypeScript, Node.js 22 native Fetch, existing `@google/genai` SDK, Express, Node test scripts.

**Spec:** `docs/superpowers/specs/2026-10-30-forgex-multi-provider-routing-design.md`

## Global Constraints

- Hybrid cloud + local operation.
- Scope includes web, mobile, Windows, accounting/business systems, and design engineering.
- Low-cost default routing; no parallel model fan-out.
- Provider secrets are environment-only and must never be returned or logged.
- Live connection status requires a successful bounded provider request.
- Existing RBAC, approval, sandbox, and rollback gates remain intact.
- No new runtime SDK dependency in this foundation.

## Review Focus

- Missing/placeholder secrets must be treated as unconfigured, not connected — test provider config parsing.
- Invalid or unsupported explicit model overrides must fail clearly — test router override validation.
- Authentication/configuration errors must not trigger fallback — test fallback classification.
- Rate limits/timeouts may trigger only bounded fallback to another configured provider — test retry cap and provider eligibility.
- Provider responses with missing content, malformed JSON, or oversized bodies must fail safely — test response normalization and limits.

---

### Task 1: Provider contracts and configuration

**Files:**
- Create: `server/ai/types.ts`
- Create: `server/ai/config.ts`
- Test: `scripts/provider-config-tests.ts`

**Interfaces:**
- `ProviderId = 'gemini' | 'anthropic' | 'openai' | 'openrouter' | 'ollama'`
- `ProviderStatus = 'NOT_CONFIGURED' | 'CONFIGURED_UNTESTED' | 'CONNECTED' | 'AUTH_ERROR' | 'RATE_LIMITED' | 'UNAVAILABLE'`
- `getProviderConfig(env, providerId)` returns enabled/configured metadata without exposing secrets.
- `getProviderStatus(providerId)` initially reports configuration state only; it does not claim a live connection.

- [x] Write tests for missing, blank, placeholder, and configured credentials; assert no returned field contains a secret.
- [x] Run `npx tsx scripts/provider-config-tests.ts` and confirm the tests fail because the module is absent.
- [x] Implement typed contracts and environment parsing for all five providers.
- [x] Run the focused test and confirm PASS.

### Task 2: Provider adapters and normalization

**Files:**
- Create: `server/ai/providers/gemini.ts`
- Create: `server/ai/providers/anthropic.ts`
- Create: `server/ai/providers/openai-compatible.ts`
- Create: `server/ai/providers/index.ts`
- Test: `scripts/provider-adapter-tests.ts`

**Interfaces:**
- `generateWithProvider(providerId, request, dependencies?)` returns normalized text, provider/model, latency, and optional token usage.
- `testProviderConnection(providerId, dependencies?)` performs a bounded ping and returns sanitized status.
- Inject `fetch` for HTTP adapter tests; use a narrow Gemini client factory seam for SDK tests.

- [x] Write tests for Anthropic Messages payload/response parsing, OpenAI-compatible chat payload/response parsing, HTTP error normalization, malformed response rejection, and timeout.
- [x] Run focused tests and confirm expected failures.
- [x] Implement Anthropic, OpenAI, OpenRouter, and Ollama adapters using documented HTTP contracts; use the existing Gemini SDK for Gemini.
- [x] Ensure request timeout, response-size limits, and sanitized error handling.
- [x] Run focused tests and confirm PASS.

### Task 3: Deterministic model router

**Files:**
- Create: `server/ai/router.ts`
- Test: `scripts/provider-router-tests.ts`

**Interfaces:**
- `routeModelRequest(request, dependencies?)` selects one provider/model and applies only bounded transient fallback.
- Task categories: `planning`, `coding`, `design`, `debugging`, `review`, `testing`, `documentation`.
- Explicit provider/model override wins only when configured and valid.
- Default low-cost policy uses configured preferred provider/model and never fans out.

- [x] Write tests for preferred-provider selection, explicit override, missing-provider behavior, auth-error no-fallback, transient fallback, and bounded attempts.
- [x] Run focused tests and confirm expected failures.
- [x] Implement deterministic routing and sanitized route results.
- [x] Run focused tests and confirm PASS.

### Task 4: Autonomous cycle and diagnostics integration

**Files:**
- Modify: `server/agent.ts`
- Modify: `server.ts`
- Modify: `scripts/runtime-smoke.mjs`
- Modify: `scripts/security-tests.mjs`
- Test: `scripts/provider-runtime-tests.ts`

**Interfaces:**
- `runAutonomousCycle` calls `routeModelRequest` instead of calling Gemini directly.
- Add authenticated `GET /api/ai/providers` and RBAC-protected `POST /api/ai/providers/:providerId/test`.
- Keep `POST /api/gemini/test` as a compatibility route backed by the provider registry.
- Health status distinguishes configured from verified-connected.
- Obsolete static `processAgentTask` code is removed and no route can invoke it.

- [x] Write tests proving the autonomous cycle invokes the router and preserves proposal schema; test provider endpoints' auth/RBAC and no-secret response.
- [x] Run focused tests and confirm expected failures.
- [x] Replace Gemini-only agent generation with routed generation; preserve existing structured response parsing and apply safety gates.
- [x] Add provider diagnostics routes and accurate health status.
- [x] Remove obsolete static agent path and extend smoke/security checks.
- [x] Run focused tests and confirm PASS.

### Task 5: Documentation, CI, and final verification

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `package.json` only if a focused test script is required.
- Modify: `.github/workflows/ci.yml` only if test commands change.

- [x] Document all provider environment variables, local Ollama networking, model overrides, and the difference between adapter tests and live connectivity.
- [x] Run `npm run lint`.
- [x] Run `npm run test`.
- [x] Run `npm run smoke`.
- [x] Run `npm run build`.
- [x] Run `docker build --tag forgex-ai-provider-routing .` where Docker is available.
- [x] Inspect the branch diff and confirm no secrets, fake connectivity claims, or unrelated changes.
