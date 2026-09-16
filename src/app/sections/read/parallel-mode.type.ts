/** How a companion edition is shown: two columns, one sentence at a time, or interleaved. */
export type ParallelMode = 'side' | 'demand' | 'inline';
export const PARALLEL_MODES: readonly ParallelMode[] = ['side', 'demand', 'inline'];
export const DEFAULT_PARALLEL_MODE: ParallelMode = 'demand';
/** Two columns of reading-size serif need this much window; below it the reader shows the companion on demand. */
export const SIDE_BY_SIDE_MIN_WIDTH = 1100;

export function isParallelMode(value: unknown): value is ParallelMode {
  return PARALLEL_MODES.includes(value as ParallelMode);
}

/** The mode's name as the picker and the header say it. */
export function parallelModeLabel(mode: ParallelMode): string {
  switch (mode) {
    case 'side': return $localize`Side by side`;
    case 'demand': return $localize`On demand`;
    case 'inline': return $localize`Inline`;
  }
}
