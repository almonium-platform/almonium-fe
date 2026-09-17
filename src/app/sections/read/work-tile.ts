import {CEFRLevel} from '../../models/userinfo.model';
import {Book} from './book.model';
import {editionKind} from './edition-kind';

/**
 * One tile per work (G14). The list endpoint stays flat and per edition; the client groups editions by
 * workSlug after the filter has run, so a level filter never hides a work that has an edition at that level.
 * The tile shows one edition's title, level and progress, and that edition is what it opens.
 */
export interface WorkTile {
  /** The work and its language: a work is one tile per shelf, and a shelf is per language. */
  key: string;
  edition: Book;
  editions: Book[];
}

/** What decides which edition a tile opens, in the order the spec lists them. */
export interface TilePreferences {
  /** The level filter, when one is set: the tile then opens the edition at that level. */
  levelFilter: CEFRLevel | null;
  /** Rank of recently opened editions by slug, lower is more recent; anything absent was never opened. */
  lastOpenedRank: ReadonlyMap<string, number>;
  /** The reader's self-reported level in the shelf's language; null for a guest. */
  selfLevel: CEFRLevel | null;
  /** A guest has no level, no history and no filter to speak for them: the original, otherwise the lowest. */
  guest: boolean;
}

const LEVEL_RANK: Record<string, number> = {A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6};

export function levelRank(level: string | null | undefined): number {
  return LEVEL_RANK[level ?? ''] ?? 0;
}

export function workKey(book: Pick<Book, 'workSlug' | 'language'>): string {
  return `${book.workSlug}|${book.language}`;
}

export function groupIntoWorks(books: readonly Book[], preferences: TilePreferences): WorkTile[] {
  const groups = new Map<string, Book[]>();
  for (const book of books) {
    const key = workKey(book);
    const editions = groups.get(key);
    if (editions) editions.push(book);
    else groups.set(key, [book]);
  }
  return [...groups].map(([key, editions]) => ({key, editions, edition: pickTileEdition(editions, preferences)}));
}

/**
 * Which edition a tile opens: the level filter if one is set; the edition the reader last opened; the closest
 * level at or below their self-reported level; the lowest level. A guest gets the original, or the lowest.
 */
export function pickTileEdition(editions: readonly Book[], preferences: TilePreferences): Book {
  if (editions.length === 1) return editions[0];
  const byLevel = [...editions].sort((a, b) => levelRank(a.cefrLevel) - levelRank(b.cefrLevel) || originalsFirst(a, b));
  const lowest = byLevel[0];

  if (preferences.guest) {
    return byLevel.find(edition => editionKind(edition.editionType) === 'original') ?? lowest;
  }
  if (preferences.levelFilter) {
    const filtered = byLevel.find(edition => edition.cefrLevel === preferences.levelFilter);
    if (filtered) return filtered;
  }
  const opened = byLevel
    .filter(edition => preferences.lastOpenedRank.has(edition.editionSlug))
    .sort((a, b) => preferences.lastOpenedRank.get(a.editionSlug)! - preferences.lastOpenedRank.get(b.editionSlug)!);
  if (opened.length > 0) return opened[0];

  const self = levelRank(preferences.selfLevel);
  if (self > 0) {
    const atOrBelow = byLevel.filter(edition => levelRank(edition.cefrLevel) <= self);
    if (atOrBelow.length > 0) return atOrBelow[atOrBelow.length - 1];
  }
  return lowest;
}

/** When sort keys tie, originals come before translations (G17). */
export function originalsFirst(a: Pick<Book, 'isTranslation'>, b: Pick<Book, 'isTranslation'>): number {
  return Number(a.isTranslation) - Number(b.isTranslation);
}
