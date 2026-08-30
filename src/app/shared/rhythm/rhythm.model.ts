import {LanguageCode} from '../../models/language.enum';
import {
  expectArray,
  expectBoolean,
  expectEnum,
  expectNullableNumber,
  expectNullableString,
  expectNumber,
  expectRecord,
  expectString,
} from '../runtime-validation';

/** Days per week a learner can ask of one language. `null` means never chosen; 0 is the deliberate "no target". */
export type WeeklyTarget = number | null;

export const TARGET_OPTIONS: {value: number; label: string; note?: string}[] = [
  {value: 1, label: 'Once a week'},
  {value: 2, label: 'Twice a week'},
  {value: 4, label: 'Four times a week'},
  {value: 0, label: 'No target', note: 'Keep the record, drop the bar'},
];

export interface RhythmDay {
  date: string;
  /** Texture for the band's tint, never a threshold for whether the day counts. */
  minutes: number;
  met: boolean;
}

export interface RhythmWeek {
  weekStart: string;
  daysMet: number;
  met: boolean;
  /** A week after the language was set aside: neither met nor missed, because nothing was asked of it. */
  frozen: boolean;
  days: RhythmDay[];
}

/** One language's harness. A set-aside language keeps its record, read-only. */
export interface LanguageRhythm {
  language: LanguageCode;
  target: WeeklyTarget;
  editable: boolean;
  /** When the language was taken up, so weeks at pace count only the weeks it has existed. */
  startedAt: string;
  /** When the language was set aside, or null while it is active. */
  setAsideAt: string | null;
  /** Oldest first, ending with the week in progress. */
  weeks: RhythmWeek[];
}

export interface Rhythm {
  languages: LanguageRhythm[];
}

export function parseRhythm(value: unknown): Rhythm {
  const rhythm = expectRecord(value, 'rhythm');
  return {
    languages: expectArray(rhythm['languages'], 'rhythm.languages')
      .map((language, index) => parseLanguageRhythm(language, `rhythm.languages[${index}]`)),
  };
}

function parseLanguageRhythm(value: unknown, path: string): LanguageRhythm {
  const rhythm = expectRecord(value, path);
  return {
    language: expectEnum(rhythm['language'], Object.values(LanguageCode), `${path}.language`),
    target: expectNullableNumber(rhythm['target'], `${path}.target`),
    editable: expectBoolean(rhythm['editable'], `${path}.editable`),
    startedAt: expectString(rhythm['startedAt'], `${path}.startedAt`),
    setAsideAt: expectNullableString(rhythm['setAsideAt'], `${path}.setAsideAt`),
    weeks: expectArray(rhythm['weeks'], `${path}.weeks`).map((week, index) => parseWeek(week, `${path}.weeks[${index}]`)),
  };
}

function parseWeek(value: unknown, path: string): RhythmWeek {
  const week = expectRecord(value, path);
  return {
    weekStart: expectString(week['weekStart'], `${path}.weekStart`),
    daysMet: expectNumber(week['daysMet'], `${path}.daysMet`),
    met: expectBoolean(week['met'], `${path}.met`),
    frozen: expectBoolean(week['frozen'], `${path}.frozen`),
    days: expectArray(week['days'], `${path}.days`).map((day, index) => parseDay(day, `${path}.days[${index}]`)),
  };
}

function parseDay(value: unknown, path: string): RhythmDay {
  const day = expectRecord(value, path);
  return {
    date: expectString(day['date'], `${path}.date`),
    minutes: expectNumber(day['minutes'], `${path}.minutes`),
    met: expectBoolean(day['met'], `${path}.met`),
  };
}

/** The learner's own calendar date, so a day belongs to them rather than to UTC. */
export function localDate(date: Date = new Date()): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function hasTarget(target: WeeklyTarget): target is number {
  return target !== null && target > 0;
}

export function cadenceLabel(target: WeeklyTarget): string {
  if (target === null) return 'No pace set';
  return TARGET_OPTIONS.find(option => option.value === target)?.label ?? `${target} times a week`;
}

const NUMBER_WORDS = [
  'No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
  'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
];

/** The record speaks in words, not figures — it is a sentence about a person, not a readout. */
export function numberWord(value: number): string {
  return NUMBER_WORDS[value] ?? `${value}`;
}

/** The Monday the given day belongs to, so a start date can be compared with a week's start. */
function weekStartOf(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  parsed.setDate(parsed.getDate() - ((parsed.getDay() + 6) % 7));
  return localDate(parsed);
}

/**
 * Only the weeks that were ever asked of: after the language was taken up, and before it was set aside. A week
 * outside that span is not a week it missed.
 */
export function trackedWeeks(rhythm: LanguageRhythm): RhythmWeek[] {
  const start = weekStartOf(rhythm.startedAt);
  return rhythm.weeks.filter(week => week.weekStart >= start && !week.frozen);
}

/** The weeks a card actually shows. Twelve is what every surface talks about. */
export function bandWeeks(rhythm: LanguageRhythm, count = 12): RhythmWeek[] {
  return rhythm.weeks.slice(-count);
}

/**
 * Weeks kept against weeks asked for, over the weeks on show. Both halves skip anything outside the language's
 * span, so a young language is not judged against twelve and a set-aside one collects no misses.
 */
export function paceFraction(rhythm: LanguageRhythm, count = 12): {met: number; counted: number} {
  const tracked = trackedWeeks(rhythm);
  const counted = bandWeeks(rhythm, count).filter(week => tracked.includes(week));
  return {met: counted.filter(week => week.met).length, counted: counted.length};
}

/** Time learning that week, in the six steps the ramp draws. */
export function weekLevel(week: RhythmWeek): number {
  if (week.frozen) return 0;
  const minutes = week.days.reduce((total, day) => total + day.minutes, 0);
  if (minutes >= 240) return 5;
  if (minutes >= 120) return 4;
  if (minutes >= 60) return 3;
  if (minutes >= 30) return 2;
  if (minutes > 0 || week.daysMet > 0) return 1;
  return 0;
}

export function weekMinutes(week: RhythmWeek): number {
  return week.days.reduce((total, day) => total + day.minutes, 0);
}
