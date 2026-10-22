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

/** How many calendar years ahead a day may be for the card to count down to it; further out it names the date. */
export const COUNTDOWN_YEARS = 5;

/** The live countdown on the card (W6): what is left until midnight on 1 January, by the reader's clock. */
export interface LiveCountdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Under a day away: the card drops the days tile. */
  lastDay: boolean;
}

/** Midnight at the start of 1 January of `year`, in the reader's time zone. */
export function newYearMidnight(year: number): Date {
  return new Date(year, 0, 1, 0, 0, 0, 0);
}

/** What is left until 1 January of `year` at `now`; all zeros once it has passed. */
export function liveCountdown(year: number, now: Date): LiveCountdown {
  const left = Math.max(0, Math.floor((newYearMidnight(year).getTime() - now.getTime()) / 1000));
  const days = Math.floor(left / 86_400);
  const hours = Math.floor((left % 86_400) / 3600);
  const minutes = Math.floor((left % 3600) / 60);
  const seconds = left % 60;
  return {days, hours, minutes, seconds, lastDay: days === 0};
}

/** What a reader's own unlock year (the year they can open the work) says on the card. */
export type ReaderFreeNote =
  /** Within five years: a live countdown to 1 January. */
  | {kind: 'live'; year: number}
  /** Further out: one line naming the date. */
  | {kind: 'date'; year: number};

/** Null when the year is unknown, already here, or past: the card then stays the plain copyright card (W2). */
export function readerFreeNote(readerFreeFrom: number | null, today: Date): ReaderFreeNote | null {
  if (readerFreeFrom === null) return null;
  const year = today.getFullYear();
  if (readerFreeFrom <= year) return null;
  return readerFreeFrom - year <= COUNTDOWN_YEARS ? {kind: 'live', year: readerFreeFrom} : {kind: 'date', year: readerFreeFrom};
}

/** The reader's country, named in their language; the code itself when the browser cannot name it. */
export function countryName(code: string, locale = navigator.language): string {
  try {
    return new Intl.DisplayNames([locale, 'en'], {type: 'region', fallback: 'none'}).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** "Public Domain Day shelf" season (W8): the rail shows from 1 October to 31 December. */
export function inUnlockSeason(today: Date): boolean {
  return today.getMonth() >= 9;
}

/** The first thirty days of a year: next year's arrivals have become this year's, and the rail says so. */
export function inArrivalSeason(today: Date): boolean {
  return today.getMonth() === 0 && today.getDate() <= 30;
}
