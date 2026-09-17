import {LanguageCode} from '../../models/language.enum';
import {expectEnum, expectNullableNumber, expectNumber, expectRecord, expectString} from '../../shared/runtime-validation';

/** What the ask sheet learns as the reader types (G19). */
export interface BookLookup {
  title: string;
  author: string;
  gutenbergId: number | null;
  /** gutenberg when the public-domain index matched, unknown otherwise. */
  publicDomain: 'gutenberg' | 'unknown';
  /** Distinct members who already asked; the sheet hides it below 2. */
  askers: number;
  /** The library copy in that language, when the shelf already has the work: the button becomes "Open it". */
  onShelf: {bookId: string; editionSlug: string; title: string} | null;
}

export interface BookRequestAsk {
  title: string;
  author: string;
  language: LanguageCode;
  /** Set when the ask comes from a book page for a language the work lacks. */
  workSlug?: string;
}

export interface BookRequest {
  id: string;
  title: string;
  author: string;
  language: LanguageCode;
  status: 'OPEN' | 'IN_PROGRESS' | 'PUBLISHED' | 'DECLINED';
  createdAt: string;
}

export function parseBookLookup(value: unknown): BookLookup {
  const data = expectRecord(value, 'lookup');
  const shelf = data['onShelf'] == null ? null : expectRecord(data['onShelf'], 'lookup.onShelf');
  return {
    title: expectString(data['title'], 'lookup.title'),
    author: expectString(data['author'], 'lookup.author'),
    gutenbergId: expectNullableNumber(data['gutenbergId'], 'lookup.gutenbergId'),
    publicDomain: expectEnum(data['publicDomain'], ['gutenberg', 'unknown'] as const, 'lookup.publicDomain'),
    askers: expectNumber(data['askers'], 'lookup.askers'),
    onShelf: shelf === null ? null : {
      bookId: expectString(shelf['bookId'], 'lookup.onShelf.bookId'),
      editionSlug: expectString(shelf['editionSlug'], 'lookup.onShelf.editionSlug'),
      title: expectString(shelf['title'], 'lookup.onShelf.title'),
    },
  };
}

export function parseBookRequest(value: unknown): BookRequest {
  const data = expectRecord(value, 'request');
  return {
    id: expectString(data['id'], 'request.id'),
    title: expectString(data['title'], 'request.title'),
    author: expectString(data['author'], 'request.author'),
    language: expectEnum(data['language'], Object.values(LanguageCode), 'request.language'),
    status: expectEnum(data['status'], ['OPEN', 'IN_PROGRESS', 'PUBLISHED', 'DECLINED'] as const, 'request.status'),
    createdAt: expectString(data['createdAt'], 'request.createdAt'),
  };
}
