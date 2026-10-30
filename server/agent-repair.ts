export interface BoundedRepairResult<T, V> {
  candidate: T;
  verification: V;
  repairs: number;
}

/**
 * Verify a candidate and permit a strictly bounded number of repair attempts.
 * The caller owns validation and side effects; this helper never applies files.
 */
export async function runBoundedRepair<T, V extends { success: boolean }>(
  initial: T,
  verify: (candidate: T) => Promise<V>,
  repair: (candidate: T, verification: V, attempt: number) => Promise<T | null>,
  maxRepairs = 2,
): Promise<BoundedRepairResult<T, V>> {
  const repairLimit = Math.max(0, Math.min(2, Math.floor(maxRepairs)));
  let candidate = initial;
  let verification = await verify(candidate);
  let repairs = 0;

  while (!verification.success && repairs < repairLimit) {
    const next = await repair(candidate, verification, repairs + 1);
    if (next === null) break;
    candidate = next;
    repairs += 1;
    verification = await verify(candidate);
  }

  return { candidate, verification, repairs };
}
