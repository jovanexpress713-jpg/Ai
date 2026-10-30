# Real Engineering Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a truthful, controlled execution layer so FORGEX can actually run a project's build and test scripts and report the results.

**Architecture:** Keep static inspection in `server/lab/orchestrator.ts`. Add a focused execution service in `server/lab/executor.ts` that maps `build` and `test` to package scripts and runs them with `spawn`. Extend Lab types and the API route without allowing arbitrary shell input. The UI will consume execution results later; this phase first makes the backend behavior real and testable.

**Tech Stack:** Node.js child_process, TypeScript, Express, existing project detection and Lab store.

**Spec:** `docs/superpowers/specs/real-engineering-agent.md`

## Global Constraints

- No arbitrary shell commands from browser input.
- Only `build` and `test` package scripts are executable through this Lab endpoint.
- Execution has a bounded timeout and output limit.
- Never claim execution passed unless the process exited successfully.
- Preserve Android Termux compatibility.

## Review Focus

- A malicious command string must be rejected rather than passed to a shell — covered by executor policy tests.
- A project with a failing script must return FAILED — covered by failure test.
- A hung script must time out — covered by timeout test.
- Missing scripts must be BLOCKED — covered by missing-script test.
- The HTTP route must return actual execution data — covered by route contract test.

---

### Task 1: Execution contract

**Files:**
- Modify: `server/lab/types.ts`
- Test: `scripts/lab-execution-tests.ts`

- [ ] Write failing tests for successful build/test, failure, missing script, timeout, and command policy.
- [ ] Run `npx tsx scripts/lab-execution-tests.ts` and verify the new tests fail because execution is not implemented.
- [ ] Add execution result types and status values.
- [ ] Run the test again and verify it passes.
- [ ] Commit.

### Task 2: Controlled executor

**Files:**
- Create: `server/lab/executor.ts`
- Modify: `scripts/lab-execution-tests.ts`

- [ ] Keep the test-first cycle for the executor behavior.
- [ ] Implement package.json script lookup for `build` and `test`.
- [ ] Execute with `spawn(command, args, { shell: false })` and a filtered environment.
- [ ] Enforce timeout and output limits.
- [ ] Return exit code, duration, stdout, stderr, and status.
- [ ] Run focused tests and then the full test suite.
- [ ] Commit.

### Task 3: Lab execution route

**Files:**
- Modify: `server.ts`
- Test: `scripts/lab-execution-route-tests.ts`

- [ ] Add failing route contract test for POST `/api/lab/run`.
- [ ] Add authenticated route that accepts only `checks: ['build'|'test']` and uses the executor.
- [ ] Save the resulting run in the existing Lab store.
- [ ] Verify route rejects unsupported commands and returns real results.
- [ ] Commit.

### Task 4: Truthful health state

**Files:**
- Modify: `server.ts`
- Test: existing health/provider test coverage or a focused health test.

- [ ] Make execution status depend on the actual executor capability, not a hardcoded connected value.
- [ ] Verify health reports unavailable when the configured workspace cannot execute.
- [ ] Run `npm run check`.
- [ ] Commit.

### Task 5: Verification

- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run smoke`.
- [ ] Run `npm run build`.
- [ ] Inspect changed files and confirm no endpoint accepts arbitrary shell commands.
- [ ] Only then report the phase as implemented; do not claim the full autonomous engineer is complete until model-backed edit/repair and live preview are also verified.
