/**
 * Public Domain Day: a work under copyright where we make books becomes free on 1 January of the year the catalogue
 * names, and the reader's own calendar decides how far off that is. Day granularity is enough; nothing here ticks.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** What a work's free year says to a reader today. */
export type FreeFromNote =
  /** Free next 1 January: a countdown in days. */
  | {kind: 'countdown'; year: number; days: number}
  /** Free on 1 January of a later year, that many calendar years from now. */
  | {kind: 'later'; year: number; years: number}
  /** Became free this 1 January. */
  | {kind: 'freeSince'; year: number};

/**
 * Whole days from the reader's local today to 1 January of `year`, counted on calendar dates so a clock change
 * between now and then never makes it 83.96 days. 0 on the day itself; negative once it has passed.
 */
export function daysUntilNewYear(year: number, today: Date): number {
  const from = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((Date.UTC(year, 0, 1) - from) / MS_PER_DAY);
}

/**
 * For a work under copyright: a countdown when it frees up next 1 January, the date and how many years when later,
 * and nothing when the year is unknown or (a stale answer) already here.
 */
export function copyrightCountdown(freeFrom: number | null, today: Date): FreeFromNote | null {
  if (freeFrom === null) return null;
  const year = today.getFullYear();
  if (freeFrom <= year) return null;
  if (freeFrom === year + 1) return {kind: 'countdown', year: freeFrom, days: daysUntilNewYear(freeFrom, today)};
  return {kind: 'later', year: freeFrom, years: freeFrom - year};
}

/** For a work that can be wanted: "Free since 1 January" only when that was this year's 1 January. */
export function freeSinceNote(freeFrom: number | null, today: Date): FreeFromNote | null {
  return freeFrom !== null && freeFrom === today.getFullYear() ? {kind: 'freeSince', year: freeFrom} : null;
}

/** The year the Public Domain Day shelf counts down to: next 1 January by the reader's calendar. */
export function nextPublicDomainYear(today: Date): number {
  return today.getFullYear() + 1;
}
