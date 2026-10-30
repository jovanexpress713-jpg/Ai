# FORGEX AI Multi-Provider Routing Design

**Status:** Approved architecture; implementation authorized by the repository owner.
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
- No image-generation, voice, embeddings, vector database, or MCP server execution in this phase.
- No promise that a provider is live-connected when its credentials or local service are unavailable.
- No UI redesign in this foundational backend phase; expose truthful APIs for the existing UI to consume in a later pass.

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
