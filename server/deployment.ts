import { recordAuditLog } from './db.ts';

export interface DeploymentResult {
  success: boolean;
  provider: 'github-actions' | 'vercel-hook';
  message: string;
  details?: unknown;
}

export function deploymentStatus() {
  const githubReady = Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME && process.env.GITHUB_WORKFLOW);
  const vercelReady = Boolean(process.env.VERCEL_DEPLOY_HOOK_URL);
  return {
    provider: githubReady ? 'github-actions' : vercelReady ? 'vercel-hook' : 'none',
    configured: githubReady || vercelReady,
    githubActions: githubReady,
    vercelHook: vercelReady,
  };
}

export async function triggerDeployment(requestedBy: string): Promise<DeploymentResult> {
  const githubReady = Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME && process.env.GITHUB_WORKFLOW);
  if (githubReady) {
    const owner = process.env.GITHUB_REPO_OWNER!;
    const repo = process.env.GITHUB_REPO_NAME!;
    const workflow = process.env.GITHUB_WORKFLOW!;
    const ref = process.env.GITHUB_DEPLOY_REF || 'main';
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'FORGEX-AI-Platform',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref }),
    });
    if (!response.ok) {
      const body = await response.text();
      recordAuditLog('SECURITY', `Deployment failed through GitHub Actions: ${response.status}`, requestedBy);
      return { success: false, provider: 'github-actions', message: `GitHub Actions deployment failed (${response.status}).`, details: body.slice(0, 1000) };
    }
    recordAuditLog('SYSTEM', `Deployment triggered through GitHub Actions for ${owner}/${repo}@${ref}`, requestedBy);
    return { success: true, provider: 'github-actions', message: `Deployment workflow ${workflow} triggered for ${owner}/${repo}@${ref}.` };
  }

  const hook = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (hook) {
    const response = await fetch(hook, { method: 'POST' });
    if (!response.ok) {
      const body = await response.text();
      return { success: false, provider: 'vercel-hook', message: `Vercel deploy hook failed (${response.status}).`, details: body.slice(0, 1000) };
    }
    recordAuditLog('SYSTEM', 'Deployment triggered through Vercel deploy hook.', requestedBy);
    return { success: true, provider: 'vercel-hook', message: 'Vercel deployment hook triggered successfully.' };
  }

  return { success: false, provider: 'vercel-hook', message: 'No deployment provider is configured.' };
}
