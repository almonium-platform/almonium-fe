import {LanguageCode} from '../../../models/language.enum';
import {CEFRLevel} from '../../../models/userinfo.model';
import {
  expectArray,
  expectBoolean,
  expectEnum,
  expectNullableNumber,
  expectNullableString,
  expectNumber,
  expectRecord,
  expectString,
} from '../../../shared/runtime-validation';

const LANGUAGES = Object.values(LanguageCode);
const LEVELS = Object.values(CEFRLevel);

/** What a want answers (W4): the work's place in the queue counting this want, and readers once there are three. */
export interface WantReceipt {
  catalogWorkId: string;
  language: LanguageCode;
  /** 1-based place in the public queue; 0 when the server could not place it. */
  rank: number;
  readers: number | null;
}

export const WANT_STATUSES = ['OPEN', 'IN_PROGRESS'] as const;
export type WantStatus = typeof WANT_STATUSES[number];

/** One work in one language on the Wanted page (W3). */
export interface WantedRow {
  catalogWorkId: string;
  title: string;
  author: string | null;
  language: LanguageCode;
  /** Set when the shelf has the work in another language: the row reads as "<Language> edition". */
  workSlug: string | null;
  rank: number;
  /** Distinct readers who want it; null below three, so a lone want never reads as "1 reader". */
  readers: number | null;
  wantedByMe: boolean;
  status: WantStatus;
  /** Being prepared from a free text: how many of the four stages are done, in order; null otherwise. */
  stagesDone: number | null;
}

/** The four stages a work being prepared from a free text goes through, in order. */
export const PREPARATION_STAGE_COUNT = 4;
export type StageState = 'done' | 'current' | 'todo';

/**
 * Each stage's state for a count of stages done: the done ones, then the one under way, then the rest. Out-of-range
 * counts are clamped rather than trusted.
 */
export function stageStates(stagesDone: number): StageState[] {
  const done = Math.max(0, Math.min(PREPARATION_STAGE_COUNT, Math.floor(stagesDone)));
  return Array.from({length: PREPARATION_STAGE_COUNT}, (_, index) =>
    index < done ? 'done' : index === done ? 'current' : 'todo');
}

/** A wanted work that reached the shelf lately. The page shows order and state only, never the date. */
export interface ArrivedRow {
  catalogWorkId: string;
  title: string;
  author: string | null;
  language: LanguageCode;
  editionSlug: string;
  cefrLevel: CEFRLevel | null;
  coverUrl: string | null;
}

export interface WantedQueue {
  /** At most two works editorial is preparing now. */
  beingPrepared: WantedRow[];
  queue: WantedRow[];
  recentlyArrived: ArrivedRow[];
  /** How many rows the viewer wants, for the "Yours · N" toggle. */
  mineCount: number;
}

export function parseWantReceipt(value: unknown): WantReceipt {
  const data = expectRecord(value, 'want');
  return {
    catalogWorkId: expectString(data['catalogWorkId'], 'want.catalogWorkId'),
    language: expectEnum(data['language'], LANGUAGES, 'want.language'),
    rank: expectNumber(data['rank'], 'want.rank'),
    readers: expectNullableNumber(data['readers'], 'want.readers'),
  };
}

function parseWantedRow(value: unknown, path: string): WantedRow {
  const data = expectRecord(value, path);
  return {
    catalogWorkId: expectString(data['catalogWorkId'], `${path}.catalogWorkId`),
    title: expectString(data['title'], `${path}.title`),
    author: expectNullableString(data['author'], `${path}.author`),
    language: expectEnum(data['language'], LANGUAGES, `${path}.language`),
    workSlug: expectNullableString(data['workSlug'], `${path}.workSlug`),
    rank: expectNumber(data['rank'], `${path}.rank`),
    readers: expectNullableNumber(data['readers'], `${path}.readers`),
    wantedByMe: expectBoolean(data['wantedByMe'], `${path}.wantedByMe`),
    status: expectEnum(data['status'], WANT_STATUSES, `${path}.status`),
    stagesDone: data['stagesDone'] === undefined ? null : expectNullableNumber(data['stagesDone'], `${path}.stagesDone`),
  };
}

function parseArrivedRow(value: unknown, path: string): ArrivedRow {
  const data = expectRecord(value, path);
  return {
    catalogWorkId: expectString(data['catalogWorkId'], `${path}.catalogWorkId`),
    title: expectString(data['title'], `${path}.title`),
    author: expectNullableString(data['author'], `${path}.author`),
    language: expectEnum(data['language'], LANGUAGES, `${path}.language`),
    editionSlug: expectString(data['editionSlug'], `${path}.editionSlug`),
    cefrLevel: data['cefrLevel'] == null ? null : expectEnum(data['cefrLevel'], LEVELS, `${path}.cefrLevel`),
    coverUrl: expectNullableString(data['coverUrl'], `${path}.coverUrl`),
  };
}

export function parseWantedQueue(value: unknown): WantedQueue {
  const data = expectRecord(value, 'wanted');
  const rows = (key: 'beingPrepared' | 'queue') =>
    expectArray(data[key], `wanted.${key}`).map((row, index) => parseWantedRow(row, `wanted.${key}[${index}]`));
  return {
    beingPrepared: rows('beingPrepared'),
    queue: rows('queue'),
    recentlyArrived: expectArray(data['recentlyArrived'], 'wanted.recentlyArrived')
      .map((row, index) => parseArrivedRow(row, `wanted.recentlyArrived[${index}]`)),
    mineCount: expectNumber(data['mineCount'], 'wanted.mineCount'),
  };
}

const ORDINAL_RULES = new Intl.PluralRules('en', {type: 'ordinal'});
const ORDINAL_SUFFIXES: Record<string, string> = {one: 'st', two: 'nd', few: 'rd', other: 'th'};

/** 1st, 2nd, 3rd, 4th, 11th, 22nd: the toast's place in line. */
export function ordinal(rank: number): string {
  return `${rank}${ORDINAL_SUFFIXES[ORDINAL_RULES.select(rank)] ?? 'th'}`;
}

/** The toast after a want (W4); a rank of 0 means the server could not place it, so the line stops at the add. */
export function wantedToastMessage(rank: number): string {
  return rank > 0
    ? $localize`Added to Wanted. It’s ${ordinal(rank)}:place: in line.`
    : $localize`Added to Wanted.`;
}

/** "12 readers", or nothing below the server's threshold of three. */
export function readersLabel(readers: number | null): string | null {
  return readers === null ? null : $localize`${readers}:count: readers`;
}
