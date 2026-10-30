# FORGEX bounded self-repair loop Implementation Plan

> **For agentic workers:** Native execution in this session; implement task-by-task and verify each task before continuing.

**Goal:** Make FORGEX attempt a small, bounded AI repair cycle when proposed code fails isolated verification, without applying unverified changes.

**Architecture:** Add a pure orchestration helper that runs verification and, only on failure, asks a supplied repair function for a revised candidate. Cap repairs at two attempts. Integrate it into task application so the existing disposable-workspace verifier remains the authority and live files are still written only after verification succeeds.

**Tech Stack:** TypeScript, Node.js test scripts, existing provider router and sandbox verifier.

**Spec:** FORGEX autonomous engineering workflow agreed in conversation.

## Global Constraints
- Never apply code that has not passed isolated verification.
- Keep live workspace untouched on failed verification.
- Never allow repair to expand beyond the files already proposed in the task.
- Maximum two AI repair attempts after the initial verification.
- Provider credentials must not appear in task results or logs.
- No fake success states; report the actual final verification output.

## Review Focus
- Initial verification succeeds: no unnecessary AI repair call.
- First repair succeeds: repaired candidate is the one applied.
- Repeated failure: stop after two repairs and preserve final failure details.
- Repair response is empty or malformed: fail closed without applying.
- Repair attempts try to add a new file: reject the repair candidate.
- Provider is unconfigured or unavailable: preserve failure and do not apply.

---

### Task 1: Bounded repair orchestration

**Files:**
- Create: `server/agent-repair.ts`
- Create: `scripts/agent-repair-tests.ts`
- Modify: `package.json`

**Interfaces:**
- `runBoundedRepair<T, V extends { success: boolean }>(initial: T, verify: (candidate: T) => Promise<V>, repair: (candidate: T, verification: V, attempt: number) => Promise<T | null>, maxRepairs?: number)`
- Returns the final candidate, final verification result, and number of repair attempts.

- [ ] Write tests for pass-through, successful repair, max-attempt stop, and null repair response.
- [ ] Run the focused test and confirm the missing module causes the expected failure.
- [ ] Implement the minimal helper.
- [ ] Run focused and full test suite.

### Task 2: Integrate AI repair into apply

**Files:**
- Modify: `server/agent.ts`

**Interfaces:**
- Use the bounded helper with `verifyProposedChanges` as verifier and `routeModelRequest` as the repair provider.
- Repair prompt includes original user request, current proposed files, and the latest verification output.
- Accept only JSON with complete replacement contents for the same set of file paths; reject additions/removals.
- Recompute diffs and apply only the final candidate after verification success.

- [ ] Add integration coverage for file-set preservation and fail-closed repair parsing.
- [ ] Run tests, lint, smoke, and production build.
- [ ] Review diff and create a draft PR; do not merge without approval.
