import type { ProposedFileChange } from './db.ts';
import { isProtectedInfrastructurePath, normalizeProposedPath } from './sandbox.ts';

export interface WorkspaceFileSnapshot {
  exists: boolean;
  content?: string;
}

export type WorkspaceSnapshotReader = (normalizedPath: string) => WorkspaceFileSnapshot;

export function validateProposedChanges(
  changes: ProposedFileChange[],
  readCurrent: WorkspaceSnapshotReader,
): { valid: true } | { valid: false; error: string } {
  if (!Array.isArray(changes) || changes.length === 0) {
    return { valid: false, error: 'The proposal contains no file changes.' };
  }

  const seen = new Set<string>();
  for (const change of changes) {
    let normalizedPath: string;
    try {
      normalizedPath = normalizeProposedPath(change.filePath);
      if (isProtectedInfrastructurePath(normalizedPath)) {
        return { valid: false, error: `Protected infrastructure file requires manual review: ${normalizedPath}` };
      }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Unsafe proposed path.' };
    }

    if (seen.has(normalizedPath)) {
      return { valid: false, error: `Duplicate proposed file path: ${normalizedPath}` };
    }
    seen.add(normalizedPath);

    let current: WorkspaceFileSnapshot;
    try {
      current = readCurrent(normalizedPath);
    } catch (error) {
      return { valid: false, error: `Could not safely inspect ${normalizedPath}: ${error instanceof Error ? error.message : String(error)}` };
    }

    // Older persisted tasks predate originalExists. Preserve compatibility for
    // non-empty originals; new tasks record existence explicitly.
    const expectedToExist = typeof change.originalExists === 'boolean'
      ? change.originalExists
      : change.originalContent.length > 0;

    if (expectedToExist && !current.exists) {
      return { valid: false, error: `File was removed after the proposal was created: ${normalizedPath}` };
    }
    if (!expectedToExist && current.exists) {
      return { valid: false, error: `A new file path already exists: ${normalizedPath}` };
    }
    if (expectedToExist && current.content !== change.originalContent) {
      return { valid: false, error: `File changed since the proposal was created: ${normalizedPath}` };
    }
  }

  return { valid: true };
}
