# FORGEX AI Real Engineering Agent

## Goal
Turn FORGEX from a partially wired agent UI into a truthful engineering loop that can inspect a workspace, execute declared build/test commands under a controlled policy, capture results, and expose those results to the UI and future repair agents.

## Scope
This phase establishes the execution foundation. It does not claim autonomous code repair until the model-backed edit loop is connected and verified.

## Required behavior
1. Project inspection must remain non-executing.
2. Execution must be explicit and use commands detected from the project's package scripts.
3. Only allowlisted script names (`build`, `test`) may be executed by the Lab execution API.
4. Commands run with a bounded timeout and captured stdout/stderr.
5. A build/test failure is represented as a failed check, never as a successful run.
6. A successful run records the exact commands executed and exit codes.
7. The server must expose a real `/api/lab/run` endpoint for authenticated users with read permission.
8. Health must report execution as available only when the execution service can actually run commands.
9. No UI state may claim a live preview or successful execution when the corresponding command was not actually run.
10. The implementation must work in the existing Node/TypeScript project and remain compatible with Android Termux when Node can execute the project commands.

## Security boundaries
- Resolve the workspace root before execution.
- Never accept arbitrary shell strings from the browser.
- Convert requested checks to known package-script names.
- Execute through `spawn` with an argument array, not a shell command string.
- Reject symlinked workspace roots.
- Enforce a maximum timeout and output size.
- Do not expose environment secrets in captured output intentionally; execution inherits only a filtered environment.

## Completion evidence
This phase is complete only when tests prove:
- build command executes and passes for a valid fixture;
- test command executes and passes for a valid fixture;
- failures are reported correctly;
- arbitrary commands are rejected;
- timeout is enforced;
- the HTTP route returns real execution results.
