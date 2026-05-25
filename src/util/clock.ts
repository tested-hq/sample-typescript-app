// Small wrapper around the wall clock. Centralising `Date.now()` makes the rest
// of the codebase trivially testable — tests can pass explicit timestamps to
// pure helpers like `isExpired` instead of stubbing globals.

const MS_PER_DAY = 86_400_000;

export function now(): number {
  return Date.now();
}

export function addDays(epochMs: number, days: number): number {
  if (!Number.isInteger(days)) {
    throw new TypeError(`addDays: days must be a finite integer, got ${days}`);
  }
  return epochMs + days * MS_PER_DAY;
}

/**
 * Returns true when `deadline` is at or before `currentTime`.
 * The boundary is inclusive: a token whose `expiresAt === now()` is expired.
 */
export function isExpired(deadline: number, currentTime: number = now()): boolean {
  return deadline <= currentTime;
}
