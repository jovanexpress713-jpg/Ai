# FORGEX Security Hardening Implementation Plan

**Goal:** Close the production authentication, protected-path, sandbox fallback, dependency, and autonomous-agent authorization failures found in the 2026-10-26 audit.

**Architecture:** Keep the existing Express/TypeScript architecture. Add small pure policy helpers for authentication and proposed-file validation, make the autonomous process endpoint use the existing real Gemini cycle instead of a hard-coded file writer, and make production sandbox/auth failures fail closed.

**Tech Stack:** Node.js 22, TypeScript, Express, Vite, Gemini SDK, GitHub Actions, bubblewrap.

## Global Constraints
- Production authentication never falls back to an implicit Owner session.
- Protected-file checks normalize paths before policy decisions.
- Production isolated execution fails closed when bubblewrap is unavailable.
- Autonomous file changes pass isolated lint/test/build before live application.
- Direct dependency versions remain pinned.
- No fake agent implementation or hard-coded source-file overwrite remains on the production agent endpoint.

## Tasks
1. Authentication policy: add pure policy helpers/tests; remove production fallback authentication; fail startup on invalid production credentials.
2. Protected path policy: normalize paths before protected-file checks; reject traversal/absolute paths and symlink escapes; test `./package.json` and `.github/*` bypasses.
3. Fail-closed sandbox: remove host fallback when isolation is required; fail production startup without bubblewrap; set `FORGEX_SANDBOX_REQUIRED=true` in Docker.
4. Real autonomous endpoint: route `/api/agent/process` through the existing Gemini-backed cycle; preserve approval mode; require APPLY_CHANGES for automatic application; remove the hard-coded writer.
5. Dependency/CI: remove the incompatible direct esbuild pin and keep CI on `npm install && npm run check`.

## Verification
GitHub Actions must run `npm install` followed by `npm run check` on the resulting commit. No completion claim is made until the resulting CI run is inspected and passes.
