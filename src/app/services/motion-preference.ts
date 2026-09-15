export interface StoredMotionPreference {
  reduceMotion?: boolean;
}

export function resolveReducedMotion(
  preference: StoredMotionPreference | null | undefined,
  mediaQuery: Pick<MediaQueryList, 'matches'>,
): boolean {
  return preference?.reduceMotion ?? mediaQuery.matches;
}

export function applyMotionPreference(root: HTMLElement, reduced: boolean): void {
  root.dataset['motion'] = reduced ? 'reduced' : 'full';
}

export function isReducedMotion(root: HTMLElement = document.documentElement): boolean {
  return root.dataset['motion'] === 'reduced';
}
