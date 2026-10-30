# FORGEX AI — Autonomous Engineering Workspace

FORGEX AI is a full-stack autonomous development workspace for inspecting, editing, verifying, reviewing, and deploying a real project from one secure interface.

## Implemented platform capabilities

- Real React/Vite studio with Arabic RTL and English LTR.
- Express server with authenticated HttpOnly sessions.
- Login throttling and timing-safe credential comparison.
- Server-side RBAC for file access, editing, terminal execution, autonomous apply, GitHub and deployment.
- Workspace path hardening against traversal and symlink escape.
- Real file tree, editor, create/delete/rename, revision backups, undo, and unified diff.
- Restricted terminal grammar with production Docker isolation requirement.
- Autonomous engineering workflow routed through a deterministic, low-cost AI provider selector.
- Direct provider adapters for Gemini, Anthropic Claude, OpenAI, OpenRouter, and local Ollama.
- Provider diagnostics APIs that distinguish not configured, configured-but-untested, and live connection verified.
- Provider fallback is sequential, bounded, and limited to transient failures; authentication/configuration failures never silently switch providers.
- Transactional autonomous apply with lint/build verification and complete rollback on verification failure.
- Persistent tasks, conversations, audit logs, terminal history, and revisions.
- Real GitHub status/repository integration with no fake data.
- Deployment adapters for GitHub Actions workflow dispatch and Vercel deploy hooks.
- Health center reporting the real configuration state of every integration.
- Production Docker image, Compose deployment, and GitHub CI verification pipeline.
- Security verification suite available through `npm run test`.

## AI providers

Configure only the providers you intend to use. Credentials are read from server environment variables and are never returned by the diagnostics API.

| Provider | Environment |
| --- | --- |
| Gemini | `GEMINI_API_KEY`, optional `FORGEX_GEMINI_MODEL` |
| Anthropic Claude | `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL` |
| OpenAI | `OPENAI_API_KEY`, optional `OPENAI_MODEL` |
| OpenRouter | `OPENROUTER_API_KEY`, optional `OPENROUTER_MODEL` |
| Ollama | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` |

Set `FORGEX_DEFAULT_PROVIDER` to a configured provider to choose the first routing preference. Without an override, the deterministic low-cost preference order is Gemini, Ollama, OpenRouter, Anthropic, then OpenAI. Only one provider is called at a time. Fallback is limited to transient rate-limit, timeout, network, or availability errors, and is capped at three attempts. Invalid credentials and other non-transient errors stop immediately.

Ollama must be reachable from the FORGEX server process. If FORGEX runs in Docker, `127.0.0.1` refers to the container itself, not the host machine or your phone. Use a reachable host/service address.

The authenticated `GET /api/ai/providers` endpoint returns safe configuration metadata. The authenticated, settings-protected `POST /api/ai/providers/:providerId/test` endpoint performs a real bounded test request. A provider marked `CONFIGURED_UNTESTED` has not been live-verified. Automated adapter tests use fixtures and do not prove live account connectivity.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`.

## Production

Set a 16+ character administrator password and the required integration secrets in `.env`.

```bash
npm install
npm run lint
npm run test
npm run build
NODE_ENV=production npm start
```

For container deployment:

```bash
docker compose up -d --build
```

Production terminal execution requires Docker isolation. If Docker is unavailable, FORGEX denies terminal execution rather than falling back to an unsafe host shell.

## Deployment adapters

### GitHub Actions
Set:

- `GITHUB_TOKEN`
- `GITHUB_REPO_OWNER`
- `GITHUB_REPO_NAME`
- `GITHUB_WORKFLOW`
- `GITHUB_DEPLOY_REF` (optional; defaults to `main`)

### Vercel
Set `VERCEL_DEPLOY_HOOK_URL`.

The deployment API never reports success unless the provider confirms the trigger request.
