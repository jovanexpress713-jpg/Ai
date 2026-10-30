import { routeModelRequest } from './ai/router.ts';
import { testProviderConnection } from './ai/providers/index.ts';
import {
  AgentTask,
  AgentCycleState,
  ProposedFileChange,
  createAgentTask,
  updateAgentTask,
  recordAuditLog,
  getDb,
} from './db.ts';
import {
  readWorkspaceFile,
  writeWorkspaceFile,
  computeUnifiedDiff,
  getWorkspaceFileTree,
  resolveSafePath,
} from './workspace-fs.ts';
import { verifyProposedChanges } from './sandbox.ts';
import fs from 'node:fs';
import { runBoundedRepair } from './agent-repair.ts';
import { validateProposedChanges } from './agent-guards.ts';


export async function testGeminiConnection(): Promise<{
  configured: boolean;
  connected: boolean;
  model?: string;
  responsePreview?: string;
  latencyMs?: number;
  error?: string;
  errorCategory?: 'AUTH_ERROR' | 'RATE_LIMIT' | 'TIMEOUT' | 'NETWORK_ERROR' | 'CONFIG_ERROR';
}> {
  const result = await testProviderConnection('gemini');
  const errorCategory = result.status === 'NOT_CONFIGURED'
    ? 'CONFIG_ERROR'
    : result.status === 'AUTH_ERROR'
      ? 'AUTH_ERROR'
      : result.status === 'RATE_LIMITED'
        ? 'RATE_LIMIT'
        : result.status === 'UNAVAILABLE'
          ? 'NETWORK_ERROR'
          : undefined;
  return {
    configured: result.configured,
    connected: result.connected,
    model: result.model,
    latencyMs: result.latencyMs,
    error: result.error,
    errorCategory,
  };
}

// System prompts tailored for specific agent roles
export const AGENT_ROLE_PROMPTS: Record<string, string> = {
  Planner: `You are the FORGEX AI Chief Planner. Your role is to break down the user request into an actionable engineering specification. Identify required architectural changes, file paths, database adjustments, and testing strategy.`,
  Coder: `You are the FORGEX AI Principal Full-Stack Engineer. Your role is to write clean, typed, resilient code without placeholders or mock data. Ensure all edits maintain strict type safety and conform to modern React/Node standards.`,
  'UI Agent': `You are the FORGEX AI Design & UI Engineer. Your role is crafting responsive, accessible, polished user interfaces supporting both RTL (Arabic) and LTR (English). Avoid generic styles and ensure responsive layout.`,
  'Database Agent': `You are the FORGEX AI Data Architect. Your role is schema integrity, data migrations, indexing, and persistent storage management.`,
  Tester: `You are the FORGEX AI QA & Test Automation Specialist. Your role is designing and verifying test suites, executing linters, running builds, and diagnosing compile or runtime errors.`,
  'Security Agent': `You are the FORGEX AI Security Auditor. Your role is strictly vetting all operations for path traversal, secret leaks (.env), XSS, command injection, and permission boundaries.`,
  'Deployment Agent': `You are the FORGEX AI Release Engineer. Your role is build artifacts validation, production bundling verification, and runtime environment health checks.`,
};

export async function runAutonomousCycle(params: {
  userRequest: string;
  assignedAgent?: string;
  requestedBy?: string;
  targetFiles?: string[];
  autoApplyIfVerified?: boolean;
}): Promise<AgentTask> {
  const {
    userRequest,
    assignedAgent = 'Planner',
    requestedBy = 'Lead Engineer',
    targetFiles = [],
    autoApplyIfVerified = false,
  } = params;

  // Step 1: Initial Task Creation (PENDING)
  const task = createAgentTask({
    title: userRequest.length > 60 ? userRequest.substring(0, 57) + '...' : userRequest,
    description: userRequest,
    assignedAgent,
    requestedBy,
    state: 'PENDING',
    steps: [
      {
        title: 'Project Detection & Context Collection',
        state: 'PENDING',
        agent: assignedAgent,
        timestamp: new Date().toISOString(),
      },
    ],
    proposedChanges: [],
  });

    try {
    // Step 2: Context Collection & Project Detection (ANALYZING)
    updateAgentTask(task.id, {
      state: 'ANALYZING',
      steps: [
        {
          title: 'Project Detection & Context Collection',
          state: 'ANALYZING',
          agent: assignedAgent,
          detail: 'Scanning workspace tree and relevant code contexts...',
          timestamp: new Date().toISOString(),
        },
      ],
    });

    const fileTree = getWorkspaceFileTree('.');
    const fileList = flattenTree(fileTree);

    // Read relevant files context if specified or select primary files
    const contextFiles: Record<string, string> = {};
    const requestTerms = userRequest.toLowerCase().split(/[^a-z0-9_؀-ۿ]+/).filter((t) => t.length >= 3);
    const sourceCandidates = fileList.filter((f) => /\.(tsx?|jsx?|json|css|md)$/.test(f));
    const rankedCandidates = sourceCandidates
      .map((file) => {
        const haystack = file.toLowerCase();
        const score = requestTerms.reduce((n, term) => n + (haystack.includes(term) ? 5 : 0), 0) +
          (file.startsWith('src/') ? 2 : 0) + (file === 'server.ts' ? 3 : 0);
        return { file, score };
      })
      .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));
    const candidateFiles = targetFiles.length > 0
      ? targetFiles
      : rankedCandidates.slice(0, 20).map((x) => x.file);

    for (const f of candidateFiles) {
      try {
        const { content } = readWorkspaceFile(f);
        // Keep larger context for the selected files; cap total context below.
        contextFiles[f] = content.length > 12000 ? content.substring(0, 12000) + '\n/* ... truncated ... */' : content;
      } catch {}
    }

    // Step 3: Planning (PLANNING)
    updateAgentTask(task.id, {
      state: 'PLANNING',
      steps: [
        {
          title: 'Project Detection & Context Collection',
          state: 'COMPLETED',
          agent: assignedAgent,
          detail: `Collected context for ${Object.keys(contextFiles).length} files across workspace.`,
          timestamp: new Date().toISOString(),
        },
        {
          title: 'Architecture & Change Planning',
          state: 'PLANNING',
          agent: assignedAgent,
          detail: 'Generating structured code modification plan...',
          timestamp: new Date().toISOString(),
        },
      ],
    });

        const systemPrompt = `${AGENT_ROLE_PROMPTS[assignedAgent] || AGENT_ROLE_PROMPTS.Planner}
You are executing an autonomous development cycle on this repository.
Your task:
1. Understand user request: "${userRequest}"
2. Review available files.
3. Propose concrete, production-ready changes.
4. Output must be valid JSON matching the schema. Do NOT invent fake or placeholder code.`;

    const promptContext = `
Workspace Files:
${fileList.join('\n')}

Selected File Contents:
${Object.entries(contextFiles)
  .map(([p, c]) => `=== FILE: ${p} ===\n${c}\n`)
  .join('\n')}

User Request: "${userRequest}"

Plan concrete modifications. For each file you propose to change, provide the relative path and full new content.`;

    // Step 4: Execute through the configured cost-aware provider router (EXECUTING)
    updateAgentTask(task.id, {
      state: 'EXECUTING',
      steps: [
        {
          title: 'Architecture & Change Planning',
          state: 'COMPLETED',
          agent: assignedAgent,
          timestamp: new Date().toISOString(),
        },
        {
          title: 'Agent Code Execution & Synthesis',
          state: 'EXECUTING',
          agent: assignedAgent,
          detail: 'Selecting one configured AI provider using the low-cost routing policy...',
          timestamp: new Date().toISOString(),
        },
      ],
    });

    const routed = await routeModelRequest({
      prompt: promptContext,
      systemPrompt: `${systemPrompt}
Return one valid JSON object only, with this exact shape:
{
  "planSummary": "short implementation summary",
  "proposedFiles": [
    {
      "filePath": "relative/path",
      "action": "create or update",
      "explanation": "why this file changes",
      "newContent": "complete new file content"
    }
  ]
}
Do not use markdown fences. Include complete file contents. Do not claim changes were applied; return proposals only.`,
      taskCategory: 'coding',
      maxOutputTokens: 8192,
      timeoutMs: 90000,
    });
    const response = { text: routed.text };
    const parsed = JSON.parse(response.text || '{}');
    const proposedChanges: ProposedFileChange[] = [];

    // Calculate real diffs for each proposed file
    if (Array.isArray(parsed.proposedFiles)) {
      for (const item of parsed.proposedFiles) {
        if (!item.filePath || typeof item.newContent !== 'string') continue;

        let originalContent = '';
        let originalExists = false;
        try {
          const res = readWorkspaceFile(item.filePath);
          originalContent = res.content;
          originalExists = true;
        } catch (error) {
          if (!(error instanceof Error) || !error.message.startsWith('File does not exist:')) throw error;
        }

        const diff = computeUnifiedDiff(originalContent, item.newContent, item.filePath);
        proposedChanges.push({
          filePath: item.filePath,
          originalContent,
          originalExists,
          newContent: item.newContent,
          diffSummary: {
            additions: diff.additions,
            deletions: diff.deletions,
            changes: diff.changes,
          },
          applied: false,
        });
      }
    }

    // Step 5: Waiting for Approval or Verification
    const nextState: AgentCycleState = autoApplyIfVerified ? 'VERIFYING' : 'WAITING_APPROVAL';

    const updated = updateAgentTask(task.id, {
      state: nextState,
      proposedChanges,
      steps: [
        {
          title: 'Agent Code Execution & Synthesis',
          state: 'COMPLETED',
          agent: assignedAgent,
          detail: `[${routed.provider}/${routed.model}] ${parsed.planSummary || `Generated ${proposedChanges.length} proposed file alterations.`}`,
          timestamp: new Date().toISOString(),
        },
        {
          title: autoApplyIfVerified ? 'Automated Verification' : 'User Review & Approval Required',
          state: nextState,
          agent: assignedAgent,
          detail: autoApplyIfVerified
            ? 'Running automated lint/build verification before applying...'
            : `Awaiting user decision to Apply or Reject ${proposedChanges.length} diff(s).`,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    recordAuditLog('AGENT', `Task ${task.id} generated ${proposedChanges.length} proposed changes`, requestedBy);
    if (autoApplyIfVerified && proposedChanges.length > 0) {
      return await applyTaskChanges(task.id);
    }
    return updated || task;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    const failed = updateAgentTask(task.id, {
      state: 'FAILED',
      error: errorMsg,
      steps: [
        {
          title: 'Execution Error',
          state: 'FAILED',
          agent: assignedAgent,
          detail: errorMsg,
          timestamp: new Date().toISOString(),
        },
      ],
    });
    recordAuditLog('AGENT', `Task ${task.id} failed: ${errorMsg}`, requestedBy);
    return failed || task;
  }
}

// Apply changes from task
export async function applyTaskChanges(taskId: string): Promise<AgentTask> {
  const task = getDb().tasks.find((t: AgentTask) => t.id === taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  if (!task.proposedChanges.length) throw new Error(`Task ${taskId} contains no proposed changes`);
  if (task.state === 'COMPLETED') return task;

  updateAgentTask(taskId, { state: 'VERIFYING' });
  try {
    const inspectSnapshot = (filePath: string) => {
      const target = resolveSafePath(filePath).fullPath;
      if (!fs.existsSync(target)) return { exists: false };
      return { exists: true, content: readWorkspaceFile(filePath).content };
    };
    const initialValidation = validateProposedChanges(task.proposedChanges, inspectSnapshot);
    if ('error' in initialValidation) {
      const failed = updateAgentTask(taskId, {
        state: 'FAILED',
        error: initialValidation.error,
        verificationResult: { success: false, stdout: '', stderr: initialValidation.error, exitCode: 1, command: 'proposal freshness and safety validation' },
      });
      recordAuditLog('SECURITY', `Rejected stale or unsafe proposal ${taskId}: ${initialValidation.error}`);
      return failed || task;
    }

    // Never execute AI-generated code in the live workspace. First validate the complete
    // proposed patch in a disposable isolated workspace, then atomically apply it.
    const repairRun = await runBoundedRepair(
      task.proposedChanges,
      (candidate) => verifyProposedChanges(candidate, ['npm run lint', 'npm run test', 'npm run build']),
      async (candidate, failedVerification, attempt) => {
        try {
          const allowedPaths = candidate.map((change) => change.filePath).sort();
          const repairResponse = await routeModelRequest({
            taskCategory: 'debugging',
            maxOutputTokens: 8192,
            timeoutMs: 90000,
            prompt: 'The previous proposed patch failed isolated verification. Repair only the already-proposed files.\n' +
              'Original task: ' + task.description + '\nRepair attempt: ' + attempt + '\n' +
              'Verification command: ' + failedVerification.command + '\nExit code: ' + failedVerification.exitCode + '\n' +
              'stdout:\n' + failedVerification.stdout + '\nstderr:\n' + failedVerification.stderr + '\n' +
              'Current proposed files:\n' + candidate.map((change) => '=== ' + change.filePath + ' ===\n' + change.newContent).join('\n') +
              '\nReturn JSON only: {"proposedFiles":[{"filePath":"existing path","newContent":"complete corrected file content"}]}. ' +
              'Return every existing path exactly once. Do not add, remove, rename, or modify any other file.',
            systemPrompt: 'You are FORGEX repair engineer. Diagnose the verification failure and return complete corrected file contents. Output valid JSON only, no markdown.',
          });
          const parsed = JSON.parse(repairResponse.text) as { proposedFiles?: Array<{ filePath?: string; newContent?: string }> };
          if (!Array.isArray(parsed.proposedFiles) || parsed.proposedFiles.length !== allowedPaths.length) return null;
          const returnedPaths = parsed.proposedFiles.map((item) => String(item.filePath || '')).sort();
          if (returnedPaths.some((filePath, index) => filePath !== allowedPaths[index])) return null;
          return parsed.proposedFiles.map((item) => {
            const previous = candidate.find((change) => change.filePath === item.filePath)!;
            if (typeof item.newContent !== 'string') throw new Error('Repair response omitted complete file content.');
            const diff = computeUnifiedDiff(previous.originalContent, item.newContent, previous.filePath);
            return { ...previous, newContent: item.newContent, diffSummary: { additions: diff.additions, deletions: diff.deletions, changes: diff.changes }, applied: false };
          });
        } catch { return null; }
      },
      2,
    );
    const candidateChanges = repairRun.candidate;
    const verification = repairRun.verification;
    if (!verification.success) {
      const failed = updateAgentTask(taskId, {
        state: 'FAILED',
        error: `Verification failed; no proposed changes were applied.`,
        verificationResult: {
          success: false,
          stdout: verification.stdout,
          stderr: verification.stderr,
          exitCode: verification.exitCode,
          command: verification.command,
        },
        steps: [
          ...task.steps,
          {
            title: 'Isolated Pre-commit Verification',
            state: 'FAILED',
            agent: 'Tester',
            detail: 'The proposed patch failed lint, tests, or build in an isolated disposable workspace. Live workspace was left untouched.',
            timestamp: new Date().toISOString(),
          },
        ],
      });
      recordAuditLog('SECURITY', `Rejected autonomous patch ${taskId}: isolated verification failed; workspace unchanged.`);
      return failed || task;
    }

    const finalValidation = validateProposedChanges(candidateChanges, inspectSnapshot);
    if ('error' in finalValidation) {
      const failed = updateAgentTask(taskId, {
        state: 'FAILED',
        error: finalValidation.error,
        verificationResult: { success: false, stdout: verification.stdout, stderr: finalValidation.error, exitCode: 1, command: 'final proposal freshness validation' },
        steps: [
          ...task.steps,
          {
            title: 'Final Workspace Conflict Check',
            state: 'FAILED',
            agent: 'Security Agent',
            detail: 'The workspace changed while verification was running. No proposed changes were applied.',
            timestamp: new Date().toISOString(),
          },
        ],
      });
      recordAuditLog('SECURITY', `Rejected proposal ${taskId} because workspace files changed during verification.`);
      return failed || task;
    }

    // Apply atomically at the task level: if any live write fails, restore every file
    // already changed by this task from the snapshots captured before the first write.
    const snapshots = new Map<string, string | null>();
    try {
      for (const change of candidateChanges) {
        try {
          snapshots.set(change.filePath, readWorkspaceFile(change.filePath).content);
        } catch {
          snapshots.set(change.filePath, null);
        }
      }
      for (const change of candidateChanges) {
        writeWorkspaceFile(change.filePath, change.newContent);
        change.applied = true;
      }
    } catch (applyError) {
      for (const [filePath, previous] of snapshots) {
        try {
          if (previous === null) {
            const target = resolveSafePath(filePath).fullPath;
            if (fs.existsSync(target)) fs.rmSync(target, { force: true });
          } else {
            writeWorkspaceFile(filePath, previous);
          }
        } catch (rollbackError) {
          recordAuditLog('SECURITY', `CRITICAL: rollback failed for ${filePath}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
        }
      }
      throw applyError;
    }

    const completed = updateAgentTask(taskId, {
      state: 'COMPLETED',
      proposedChanges: candidateChanges,
      verificationResult: {
        success: true,
        stdout: verification.stdout,
        stderr: verification.stderr,
        exitCode: 0,
        command: verification.command,
      },
      steps: [
        ...task.steps,
        {
          title: 'Isolated Pre-commit Verification',
          state: 'COMPLETED',
          agent: 'Tester',
          detail: 'Lint, tests, and production build passed in an isolated disposable workspace after ' + repairRun.repairs + ' AI repair attempt(s); verified changes were then applied to the live workspace.',
          timestamp: new Date().toISOString(),
        },
      ],
    });
    recordAuditLog('AGENT', `Applied verified changes for task ${taskId}. Isolated lint, tests, and build passed after ${repairRun.repairs} repair attempt(s).`);
    return completed || task;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    updateAgentTask(taskId, { state: 'FAILED', error: errorMsg });
    recordAuditLog('SECURITY', `Autonomous patch ${taskId} was not applied: ${errorMsg}`);
    throw err;
  }
}

// Reject task changes
export function rejectTaskChanges(taskId: string): AgentTask {
  const task = updateAgentTask(taskId, {
    state: 'CANCELLED',
    steps: [
      {
        title: 'User Rejected Changes',
        state: 'CANCELLED',
        agent: 'User',
        detail: 'User declined to apply proposed diffs.',
        timestamp: new Date().toISOString(),
      },
    ],
  });
  if (!task) throw new Error(`Task ${taskId} not found`);
  recordAuditLog('AGENT', `User rejected changes for task ${taskId}`);
  return task;
}

function flattenTree(nodes: any[]): string[] {
  const result: string[] = [];
  for (const n of nodes) {
    if (n.type === 'file') {
      result.push(n.path);
    } else if (n.children) {
      result.push(...flattenTree(n.children));
    }
  }
  return result;
}

