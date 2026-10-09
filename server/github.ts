import { readWorkspaceFile, getAllWorkspaceFiles } from './workspace-fs.ts';

interface SyncOptions {
  repo: string;          // e.g. "owner/repo"
  branch?: string;        // defaults to default_branch, or "main"
  message?: string;       // commit message
  filePaths?: string[];   // subset of paths, or all workspace files if undefined
  token: string;
}

export interface SyncResult {
  success: boolean;
  commitSha: string;
  commitUrl: string;
  branch: string;
  repo: string;
  syncedFilesCount: number;
  files: string[];
  timestamp: string;
}

const GITHUB_API_URL = 'https://api.github.com';

async function ghFetch(url: string, token: string, options: RequestInit = {}): Promise<any> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'FORGEX-AI-Platform',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const fullUrl = url.startsWith('http') ? url : `${GITHUB_API_URL}${url}`;
  const res = await fetch(fullUrl, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const errorMsg = isJson && data.message ? data.message : res.statusText;
    throw new Error(`GitHub API Error (${res.status}): ${errorMsg}`);
  }

  return data;
}

export async function fetchUserRepos(token: string) {
  return ghFetch('/user/repos?per_page=50&sort=updated&type=all', token);
}

export async function fetchRepoBranches(repo: string, token: string) {
  const [owner, name] = repo.split('/');
  if (!owner || !name) throw new Error('Invalid repository format. Expected "owner/repo".');
  return ghFetch(`/repos/${owner}/${name}/branches?per_page=50`, token);
}

export async function syncWorkspaceToGitHub(options: SyncOptions): Promise<SyncResult> {
  const { repo, token, filePaths } = options;
  const [owner, name] = repo.split('/');
  if (!owner || !name) {
    throw new Error('Invalid repository format. Please specify "owner/repository" (e.g. jovanexpress713-jpg/Ai).');
  }

  // 1. Fetch repo details to get default branch
  const repoData = await ghFetch(`/repos/${owner}/${name}`, token);
  const targetBranch = (options.branch && options.branch.trim()) || repoData.default_branch || 'main';
  const commitMessage = (options.message && options.message.trim()) || 'Sync workspace files from FORGEX AI Studio';

  // 2. Gather files to sync
  let filesToSync: Array<{ path: string; content: string }> = [];

  if (filePaths && filePaths.length > 0) {
    for (const fpath of filePaths) {
      // Normalize path
      const cleanPath = fpath.replace(/^[/\\]+/, '');
      if (cleanPath.startsWith('.env') || cleanPath === 'bun.lock') continue;
      try {
        const { content } = readWorkspaceFile(cleanPath);
        filesToSync.push({ path: cleanPath, content });
      } catch (err: any) {
        console.warn(`[GitHub Sync] Skipped unreadable file ${cleanPath}:`, err.message);
      }
    }
  } else {
    const allFiles = getAllWorkspaceFiles('.');
    filesToSync = allFiles.map((f) => ({ path: f.path, content: f.content }));
  }

  if (filesToSync.length === 0) {
    throw new Error('No valid workspace files found to sync.');
  }

  // 3. Get current branch reference (latest commit)
  let parentCommitSha: string | null = null;
  let baseTreeSha: string | null = null;

  try {
    const refData = await ghFetch(`/repos/${owner}/${name}/git/ref/heads/${targetBranch}`, token);
    parentCommitSha = refData.object.sha;
    if (parentCommitSha) {
      const commitData = await ghFetch(`/repos/${owner}/${name}/git/commits/${parentCommitSha}`, token);
      baseTreeSha = commitData.tree.sha;
    }
  } catch (err: any) {
    // If branch doesn't exist, check default branch or empty repo
    if (err.message.includes('404')) {
      try {
        const defaultRef = await ghFetch(`/repos/${owner}/${name}/git/ref/heads/${repoData.default_branch}`, token);
        parentCommitSha = defaultRef.object.sha;
        const commitData = await ghFetch(`/repos/${owner}/${name}/git/commits/${parentCommitSha}`, token);
        baseTreeSha = commitData.tree.sha;
      } catch {
        // Repo might be brand new / empty without any commits
        parentCommitSha = null;
        baseTreeSha = null;
      }
    } else {
      throw err;
    }
  }

  // 4. Construct tree items (create blobs for large files > 60KB, inline content for others)
  const treeItems: Array<{ path: string; mode: string; type: string; sha?: string; content?: string }> = [];

  for (const file of filesToSync) {
    if (file.content.length > 60000) {
      // Create blob separately
      const blob = await ghFetch(`/repos/${owner}/${name}/git/blobs`, token, {
        method: 'POST',
        body: JSON.stringify({
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64',
        }),
      });
      treeItems.push({
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      });
    } else {
      treeItems.push({
        path: file.path,
        mode: '100644',
        type: 'blob',
        content: file.content,
      });
    }
  }

  // 5. Create new Git tree
  const treePayload: Record<string, any> = { tree: treeItems };
  if (baseTreeSha) {
    treePayload.base_tree = baseTreeSha;
  }

  const newTree = await ghFetch(`/repos/${owner}/${name}/git/trees`, token, {
    method: 'POST',
    body: JSON.stringify(treePayload),
  });

  // 6. Create Git commit
  const commitPayload: Record<string, any> = {
    message: commitMessage,
    tree: newTree.sha,
    parents: parentCommitSha ? [parentCommitSha] : [],
  };

  const newCommit = await ghFetch(`/repos/${owner}/${name}/git/commits`, token, {
    method: 'POST',
    body: JSON.stringify(commitPayload),
  });

  // 7. Update or create branch ref
  if (parentCommitSha) {
    try {
      await ghFetch(`/repos/${owner}/${name}/git/refs/heads/${targetBranch}`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          sha: newCommit.sha,
          force: false,
        }),
      });
    } catch {
      // If updating fails because the branch is new, create it
      await ghFetch(`/repos/${owner}/${name}/git/refs`, token, {
        method: 'POST',
        body: JSON.stringify({
          ref: `refs/heads/${targetBranch}`,
          sha: newCommit.sha,
        }),
      });
    }
  } else {
    // Brand new repo: create ref
    await ghFetch(`/repos/${owner}/${name}/git/refs`, token, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${targetBranch}`,
        sha: newCommit.sha,
      }),
    });
  }

  const commitUrl = newCommit.html_url || `https://github.com/${owner}/${name}/commit/${newCommit.sha}`;

  return {
    success: true,
    commitSha: newCommit.sha,
    commitUrl,
    branch: targetBranch,
    repo: `${owner}/${name}`,
    syncedFilesCount: filesToSync.length,
    files: filesToSync.map((f) => f.path),
    timestamp: new Date().toISOString(),
  };
}
