import {
  expectArray,
  expectBoolean,
  expectEnum,
  expectNullableNumber,
  expectNullableString,
  expectRecord,
  expectString,
} from '../../../shared/runtime-validation';

/**
 * What the reader can do with a catalogue work (W1, W2): open it from the shelf, learn the shelf has it but not
 * for their country, want it, or learn it is still under copyright.
 */
export const CATALOG_STATES = ['ON_SHELF', 'NOT_IN_YOUR_COUNTRY', 'WANTABLE', 'UNDER_COPYRIGHT'] as const;
export type CatalogState = typeof CATALOG_STATES[number];

/** One notable book from the catalogue search: metadata only, never a text. */
export interface CatalogHit {
  id: string;
  title: string;
  originalTitle: string | null;
  originalLanguage: string | null;
  author: string | null;
  year: number | null;
  state: CatalogState;
  /** The shelf work it is linked to, when there is one. */
  workSlug: string | null;
  /**
   * Set only when exact: the year it becomes free where we make books, from 1 January (UNDER_COPYRIGHT), or the year
   * it became free (WANTABLE); null when unknown or only a lower bound.
   */
  freeFrom: number | null;
  /** Distinct members wanting it in the language searched for; null below three, or when no language was sent. */
  readers: number | null;
  /** Whether the signed-in viewer wants it in that language; always false for a guest. */
  wantedByMe: boolean;
  /** The reader's country as the server placed them, ISO 3166 alpha-2; null when it did not say. */
  readerCountry: string | null;
  /**
   * The year the reader can open it, from 1 January: free where we make books and in their own country, when both
   * are exact (W6). Null when unknown, and when it is already free.
   */
  readerFreeFrom: number | null;
  /** Up to three countries where it is already free, best known first (W6); empty unless under copyright. */
  freeIn: string[];
}

export function parseCatalogHit(value: unknown, path = 'hit'): CatalogHit {
  const data = expectRecord(value, path);
  return {
    id: expectString(data['id'], `${path}.id`),
    title: expectString(data['title'], `${path}.title`),
    originalTitle: expectNullableString(data['originalTitle'], `${path}.originalTitle`),
    originalLanguage: expectNullableString(data['originalLanguage'], `${path}.originalLanguage`),
    author: expectNullableString(data['author'], `${path}.author`),
    year: expectNullableNumber(data['year'], `${path}.year`),
    state: expectEnum(data['state'], CATALOG_STATES, `${path}.state`),
    workSlug: expectNullableString(data['workSlug'], `${path}.workSlug`),
    freeFrom: expectNullableNumber(data['freeFrom'], `${path}.freeFrom`),
    readers: expectNullableNumber(data['readers'], `${path}.readers`),
    wantedByMe: data['wantedByMe'] === undefined ? false : expectBoolean(data['wantedByMe'], `${path}.wantedByMe`),
    readerCountry: data['readerCountry'] === undefined ? null : expectNullableString(data['readerCountry'], `${path}.readerCountry`),
    readerFreeFrom: data['readerFreeFrom'] === undefined ? null : expectNullableNumber(data['readerFreeFrom'], `${path}.readerFreeFrom`),
    freeIn: data['freeIn'] === undefined ? [] : expectArray(data['freeIn'], `${path}.freeIn`).map((code, index) => expectString(code, `${path}.freeIn[${index}]`)),
  };
}

export function parseCatalogHits(value: unknown): CatalogHit[] {
  return expectArray(value, 'hits').map((hit, index) => parseCatalogHit(hit, `hits[${index}]`));
}

/** What the "Not on the shelf yet" section shows for one search. */
export interface CatalogResultsPlan {
  /** The best hit, when it is under copyright: one plain card above the rows. */
  copyright: CatalogHit | null;
  /** Works the reader can want, or learns are not for their country. The shelf grid already shows the rest. */
  rows: CatalogHit[];
}

/**
 * Sorts the catalogue's answer into the section. Books on the shelf are already in the grid above; a book under
 * copyright earns the card only when it is the best hit for the query, because the reader most likely meant it,
 * and is left out of the rows otherwise: there is nothing to do with it.
 */
export function planCatalogResults(hits: readonly CatalogHit[]): CatalogResultsPlan {
  const best = hits[0];
  return {
    copyright: best?.state === 'UNDER_COPYRIGHT' ? best : null,
    rows: hits.filter(hit => hit.state === 'WANTABLE' || hit.state === 'NOT_IN_YOUR_COUNTRY'),
  };
}

/** "author · year", whichever of the two is known. */
export function catalogMeta(hit: Pick<CatalogHit, 'author' | 'year'>): string {
  return [hit.author, hit.year === null ? null : String(hit.year)].filter(Boolean).join(' · ');
}

/** The catalogue folds accents and punctuation and needs two characters of what is left. */
export function isCatalogQuery(query: string): boolean {
  return query.normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '').length >= 2;
}

/** Whether a work is free in one country this year, the year it frees up when exact, and the rule behind it (W7). */
export const RIGHTS_STATUSES = ['FREE', 'PROTECTED', 'UNKNOWN'] as const;
export type RightsStatus = typeof RIGHTS_STATUSES[number];

export interface CountryUnlock {
  /** ISO 3166 alpha-2. */
  country: string;
  status: RightsStatus;
  year: number | null;
  rule: string;
}

/** The unlock map's data for one work: every country, plus the reader's own place and day. */
export interface WorkUnlocks {
  id: string;
  title: string;
  author: string | null;
  year: number | null;
  readerCountry: string;
  readerFreeFrom: number | null;
  countries: CountryUnlock[];
}

export function parseWorkUnlocks(value: unknown): WorkUnlocks {
  const data = expectRecord(value, 'unlocks');
  return {
    id: expectString(data['id'], 'unlocks.id'),
    title: expectString(data['title'], 'unlocks.title'),
    author: expectNullableString(data['author'], 'unlocks.author'),
    year: expectNullableNumber(data['year'], 'unlocks.year'),
    readerCountry: expectString(data['readerCountry'], 'unlocks.readerCountry'),
    readerFreeFrom: expectNullableNumber(data['readerFreeFrom'], 'unlocks.readerFreeFrom'),
    countries: expectArray(data['countries'], 'unlocks.countries').map((item, index) => {
      const row = expectRecord(item, `unlocks.countries[${index}]`);
      return {
        country: expectString(row['country'], `unlocks.countries[${index}].country`),
        status: expectEnum(row['status'], RIGHTS_STATUSES, `unlocks.countries[${index}].status`),
        year: expectNullableNumber(row['year'], `unlocks.countries[${index}].year`),
        rule: expectString(row['rule'], `unlocks.countries[${index}].rule`),
      };
    }),
  };
}

/** Countries grouped by the year they free the work, soonest first; the ones with no year last (W7's list form). */
export interface UnlockYearGroup {
  year: number | null;
  countries: CountryUnlock[];
}

export function groupUnlocksByYear(unlocks: readonly CountryUnlock[]): UnlockYearGroup[] {
  const byYear = new Map<number | null, CountryUnlock[]>();
  for (const unlock of unlocks) {
    const key = unlock.status === 'UNKNOWN' ? null : unlock.year;
    byYear.set(key, [...(byYear.get(key) ?? []), unlock]);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a - b))
    .map(([year, countries]) => ({year, countries}));
}
