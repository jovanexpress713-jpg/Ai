import fs from 'node:fs';
import path from 'node:path';
import { storeFileBackup, popFileBackup, recordAuditLog } from './db.ts';

export interface FileNode {
  name: string;
  path: string; // relative to workspace root
  type: 'file' | 'directory';
  size?: number;
  updatedAt?: string;
  children?: FileNode[];
}

export interface DiffLine {
  type: 'unchanged' | 'addition' | 'deletion';
  originalLineNumber?: number;
  modifiedLineNumber?: number;
  content: string;
}

export interface FileDiffResult {
  filePath: string;
  additions: number;
  deletions: number;
  changes: number;
  lines: DiffLine[];
}

const WORKSPACE_ROOT = path.resolve(process.env.FORGEX_WORKSPACE_ROOT || process.cwd());

// Normalize and strictly validate path inside WORKSPACE_ROOT
export function resolveSafePath(userPath: string): { fullPath: string; relPath: string } {
  // Disallow absolute root paths like /etc, /root, /var
  const cleaned = userPath.replace(/^[/\\]+/, '');
  const resolved = path.resolve(WORKSPACE_ROOT, cleaned);

  const rootWithSep = WORKSPACE_ROOT.endsWith(path.sep) ? WORKSPACE_ROOT : WORKSPACE_ROOT + path.sep;
  if (resolved !== WORKSPACE_ROOT && !resolved.startsWith(rootWithSep)) {
    throw new Error(`Access Denied: Path "${userPath}" escapes workspace root.`);
  }

  // Deny access to sensitive files
  const base = path.basename(resolved);
  if (base === '.env' || base.startsWith('.env.')) {
    throw new Error(`Security Denied: Direct read/write of environment secrets is restricted.`);
  }

  const rel = path.relative(WORKSPACE_ROOT, resolved) || '.';
  // Reject symlinks that resolve outside the workspace, including an existing
  // symlinked parent when the requested leaf does not exist yet.
  const realRoot = fs.realpathSync(WORKSPACE_ROOT);
  let existing = resolved;
  while (!fs.existsSync(existing) && existing !== WORKSPACE_ROOT) {
    existing = path.dirname(existing);
  }
  const realTarget = fs.realpathSync(existing);
  const realRootWithSep = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
  if (realTarget !== realRoot && !realTarget.startsWith(realRootWithSep)) {
    throw new Error(`Access Denied: Symlink/path resolves outside workspace.`);
  }
  return { fullPath: resolved, relPath: rel };
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.vite',
  'dist',
  '.vite-temp',
  '.cache'
]);

// Build recursive tree
export function getWorkspaceFileTree(dirRelPath = '.'): FileNode[] {
  const { fullPath } = resolveSafePath(dirRelPath);
  if (!fs.existsSync(fullPath)) return [];

  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  const result: FileNode[] = [];

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;

    const childRelPath = path.posix.join(dirRelPath === '.' ? '' : dirRelPath, entry.name);
    const childFullPath = path.resolve(WORKSPACE_ROOT, childRelPath);

    try {
      const stats = fs.statSync(childFullPath);
      if (entry.isDirectory()) {
        result.push({
          name: entry.name,
          path: childRelPath,
          type: 'directory',
          updatedAt: stats.mtime.toISOString(),
          children: getWorkspaceFileTree(childRelPath),
        });
      } else {
        result.push({
          name: entry.name,
          path: childRelPath,
          type: 'file',
          size: stats.size,
          updatedAt: stats.mtime.toISOString(),
        });
      }
    } catch {
      // Ignore unreadable
    }
  }

  // Sort directories first, then alphabetical
  return result.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'directory' ? -1 : 1;
  });
}

// Read real file
export function readWorkspaceFile(userPath: string): { content: string; relPath: string; size: number } {
  const { fullPath, relPath } = resolveSafePath(userPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File does not exist: "${relPath}"`);
  }

  const stats = fs.statSync(fullPath);
  if (stats.isDirectory()) {
    throw new Error(`Path is a directory, not a file: "${relPath}"`);
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  return { content, relPath, size: stats.size };
}

// Write real file with auto backup
export function writeWorkspaceFile(userPath: string, newContent: string): { success: boolean; relPath: string } {
  const { fullPath, relPath } = resolveSafePath(userPath);

  // Backup current version if file already exists
  if (fs.existsSync(fullPath)) {
    const prev = fs.readFileSync(fullPath, 'utf-8');
    storeFileBackup(relPath, prev);
  }

  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(fullPath, newContent, 'utf-8');
  recordAuditLog('FILE', `Modified file ${relPath}`, 'User');

  return { success: true, relPath };
}

// Create new file or folder
export function createWorkspaceItem(userPath: string, isDirectory = false, initialContent = ''): { success: boolean; relPath: string } {
  const { fullPath, relPath } = resolveSafePath(userPath);

  if (fs.existsSync(fullPath)) {
    throw new Error(`Item already exists: "${relPath}"`);
  }

  if (isDirectory) {
    fs.mkdirSync(fullPath, { recursive: true });
    recordAuditLog('FILE', `Created directory ${relPath}`);
  } else {
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(fullPath, initialContent, 'utf-8');
    recordAuditLog('FILE', `Created file ${relPath}`);
  }

  return { success: true, relPath };
}

// Delete file or directory
export function deleteWorkspaceItem(userPath: string): { success: boolean; relPath: string } {
  const { fullPath, relPath } = resolveSafePath(userPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Item not found: "${relPath}"`);
  }

  // Backup file before deletion
  if (!fs.statSync(fullPath).isDirectory()) {
    const prev = fs.readFileSync(fullPath, 'utf-8');
    storeFileBackup(relPath, prev);
    fs.unlinkSync(fullPath);
  } else {
    fs.rmSync(fullPath, { recursive: true, force: true });
  }

  recordAuditLog('FILE', `Deleted item ${relPath}`);
  return { success: true, relPath };
}

// Rename or Move
export function renameWorkspaceItem(oldPath: string, newPath: string): { success: boolean; from: string; to: string } {
  const { fullPath: srcFull, relPath: srcRel } = resolveSafePath(oldPath);
  const { fullPath: destFull, relPath: destRel } = resolveSafePath(newPath);

  if (!fs.existsSync(srcFull)) {
    throw new Error(`Source does not exist: "${srcRel}"`);
  }
  if (fs.existsSync(destFull)) {
    throw new Error(`Destination already exists: "${destRel}"`);
  }

  const parentDir = path.dirname(destFull);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  fs.renameSync(srcFull, destFull);
  recordAuditLog('FILE', `Renamed ${srcRel} -> ${destRel}`);
  return { success: true, from: srcRel, to: destRel };
}

// Undo/Restore from DB revision stack
export function undoFileChange(userPath: string): { success: boolean; relPath: string; restoredContent: string } {
  const { fullPath, relPath } = resolveSafePath(userPath);
  const prevContent = popFileBackup(relPath);

  if (prevContent === null) {
    throw new Error(`No undo history found for "${relPath}"`);
  }

  fs.writeFileSync(fullPath, prevContent, 'utf-8');
  recordAuditLog('FILE', `Reverted/Undid changes to ${relPath}`);
  return { success: true, relPath, restoredContent: prevContent };
}

// Compute real line-by-line diff
export function computeUnifiedDiff(original: string, modified: string, filePath: string): FileDiffResult {
  const origLines = original.split(/\r?\n/);
  const modLines = modified.split(/\r?\n/);

  const diffLines: DiffLine[] = [];
  let additions = 0;
  let deletions = 0;

  // Simple, accurate LCS-based or line-by-line comparison
  let i = 0;
  let j = 0;

  while (i < origLines.length || j < modLines.length) {
    if (i < origLines.length && j < modLines.length && origLines[i] === modLines[j]) {
      diffLines.push({
        type: 'unchanged',
        originalLineNumber: i + 1,
        modifiedLineNumber: j + 1,
        content: origLines[i],
      });
      i++;
      j++;
    } else {
      // Lookahead matching
      let matchInMod = -1;
      let matchInOrig = -1;

      for (let look = 1; look <= 5; look++) {
        if (j + look < modLines.length && origLines[i] === modLines[j + look] && matchInMod === -1) {
          matchInMod = j + look;
        }
        if (i + look < origLines.length && origLines[i + look] === modLines[j] && matchInOrig === -1) {
          matchInOrig = i + look;
        }
      }

      if (matchInMod !== -1 && (matchInOrig === -1 || matchInMod <= matchInOrig)) {
        // Insertion
        while (j < matchInMod) {
          diffLines.push({
            type: 'addition',
            modifiedLineNumber: j + 1,
            content: modLines[j],
          });
          additions++;
          j++;
        }
      } else if (matchInOrig !== -1) {
        // Deletion
        while (i < matchInOrig) {
          diffLines.push({
            type: 'deletion',
            originalLineNumber: i + 1,
            content: origLines[i],
          });
          deletions++;
          i++;
        }
      } else {
        // Line replacement
        if (i < origLines.length) {
          diffLines.push({
            type: 'deletion',
            originalLineNumber: i + 1,
            content: origLines[i],
          });
          deletions++;
          i++;
        }
        if (j < modLines.length) {
          diffLines.push({
            type: 'addition',
            modifiedLineNumber: j + 1,
            content: modLines[j],
          });
          additions++;
          j++;
        }
      }
    }
  }

  return {
    filePath,
    additions,
    deletions,
    changes: additions + deletions,
    lines: diffLines,
  };
}
