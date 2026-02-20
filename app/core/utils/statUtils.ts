// app/core/utils/statUtils.ts

/**
 * Returns the percentage of `done` out of `total`, rounded to the nearest integer.
 * Returns 0 if total is 0 to avoid division by zero.
 */
export function safePct(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}
