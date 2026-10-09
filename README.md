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
- Autonomous Gemini workflow with project-aware context ranking and structured file proposals.
- Transactional autonomous apply with lint/build verification and complete rollback on verification failure.
- Persistent tasks, conversations, audit logs, terminal history, and revisions.
- Real GitHub status/repository integration with no fake data.
- Deployment adapters for GitHub Actions workflow dispatch and Vercel deploy hooks.
- Health center reporting the real configuration state of every integration.
- Production Docker image, Compose deployment, and GitHub CI verification pipeline.
- Security verification suite available through `npm run test`.

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
