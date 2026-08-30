import {LanguageCode} from '../../models/language.enum';
import {
  expectArray,
  expectBoolean,
  expectEnum,
  expectNullableNumber,
  expectNumber,
  expectRecord,
  expectString,
} from '../runtime-validation';

/** Days per week a learner can ask of one language. `null` means never chosen; 0 is the deliberate "no target". */
export type WeeklyTarget = number | null;

export const TARGET_OPTIONS: {value: number; label: string}[] = [
  {value: 2, label: '2×'},
  {value: 3, label: '3×'},
  {value: 5, label: '5×'},
  {value: 7, label: 'Daily'},
  {value: 0, label: 'No target'},
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
  days: RhythmDay[];
}

/** One language's harness. A set-aside language keeps its record, read-only. */
export interface LanguageRhythm {
  language: LanguageCode;
  target: WeeklyTarget;
  editable: boolean;
  /** When the language was taken up, so weeks at pace count only the weeks it has existed. */
  startedAt: string;
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
    weeks: expectArray(rhythm['weeks'], `${path}.weeks`).map((week, index) => parseWeek(week, `${path}.weeks[${index}]`)),
  };
}

function parseWeek(value: unknown, path: string): RhythmWeek {
  const week = expectRecord(value, path);
  return {
    weekStart: expectString(week['weekStart'], `${path}.weekStart`),
    daysMet: expectNumber(week['daysMet'], `${path}.daysMet`),
    met: expectBoolean(week['met'], `${path}.met`),
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
  if (target === 0) return 'No target';
  return target === 7 ? 'Daily' : `${target}× a week`;
}

/** The Monday the given day belongs to, so a start date can be compared with a week's start. */
function weekStartOf(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  parsed.setDate(parsed.getDate() - ((parsed.getDay() + 6) % 7));
  return localDate(parsed);
}

/** Only the weeks the language has actually existed: a language taken up in June is not judged against fourteen. */
export function trackedWeeks(rhythm: LanguageRhythm): RhythmWeek[] {
  const start = weekStartOf(rhythm.startedAt);
  return rhythm.weeks.filter(week => week.weekStart >= start);
}

export function weeksAtPace(rhythm: LanguageRhythm): number {
  return trackedWeeks(rhythm).filter(week => week.met).length;
}
