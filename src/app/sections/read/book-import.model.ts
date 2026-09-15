import {LanguageCode} from '../../models/language.enum';
import {expectArray, expectEnum, expectNumber, expectRecord, expectString, expectUuid} from '../../shared/runtime-validation';

export enum BookImportStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
}

/** Whether the book's details still await the owner's confirmation. */
export enum BookImportMetadataStatus {
  PENDING = 'PENDING',
  PROPOSED = 'PROPOSED',
  CONFIRMED = 'CONFIRMED',
}

/** Who supplied a detail: the owner, the file's own header, or the processor's AI proposal. */
export type BookImportProvenance = 'user' | 'source' | 'ai';

/** Where a private import stands with the library: asked, being ingested, or already there. Declined ones are not returned. */
export enum LibrarySuggestionStatus {
  SUGGESTED = 'SUGGESTED',
  INGESTING = 'INGESTING',
  PUBLISHED = 'PUBLISHED',
}

export interface LibrarySuggestion {
  id: string;
  status: LibrarySuggestionStatus;
  createdAt: string;
  /** Set once the work is in the library, whether it was ingested or merely pointed at an existing copy. */
  libraryEditionSlug: string | null;
  libraryTitle: string | null;
  /** Languages the library copy can be read alongside, other than its own. */
  libraryParallelLanguages: LanguageCode[];
}

export interface BookImport {
  id: string;
  title: string;
  author: string;
  description: string;
  /** Unknown until the processor has read the file, unless the owner chose it at upload. */
  language: LanguageCode | null;
  publicationYear: number | null;
  status: BookImportStatus;
  metadataStatus: BookImportMetadataStatus;
  metadataProvenance: Partial<Record<BookImportMetadataField, BookImportProvenance>>;
  progress: number;
  wordCount: number;
  error: string;
  librarySuggestion: LibrarySuggestion | null;
}

export type BookImportMetadataField = 'title' | 'author' | 'description' | 'language' | 'publication_year';

export interface BookImportMetadataUpdate {
  title: string;
  author: string;
  description: string;
  language: LanguageCode;
  publicationYear: number | null;
}

export interface BookImportQuota {
  limit: number;
  used: number;
  periodStartsAt: string;
  periodEndsAt: string;
}

export function parseBookImport(value: unknown): BookImport {
  const data = expectRecord(value, 'bookImport');
  return {
    id: expectUuid(data['id'], 'bookImport.id'),
    title: expectString(data['title'], 'bookImport.title'),
    author: expectString(data['author'], 'bookImport.author'),
    description: expectString(data['description'], 'bookImport.description'),
    language: data['language'] === null || data['language'] === undefined
      ? null
      : expectEnum(data['language'], Object.values(LanguageCode), 'bookImport.language'),
    publicationYear: data['publicationYear'] === null
      ? null
      : expectNumber(data['publicationYear'], 'bookImport.publicationYear'),
    status: expectEnum(data['status'], Object.values(BookImportStatus), 'bookImport.status'),
    metadataStatus: expectEnum(
      data['metadataStatus'],
      Object.values(BookImportMetadataStatus),
      'bookImport.metadataStatus',
    ),
    metadataProvenance: parseProvenance(data['metadataProvenance']),
    progress: expectNumber(data['progress'], 'bookImport.progress'),
    wordCount: expectNumber(data['wordCount'], 'bookImport.wordCount'),
    error: expectString(data['error'], 'bookImport.error'),
    librarySuggestion: data['librarySuggestion'] === null || data['librarySuggestion'] === undefined
      ? null
      : parseLibrarySuggestion(data['librarySuggestion']),
  };
}

export function parseLibrarySuggestion(value: unknown, path = 'bookImport.librarySuggestion'): LibrarySuggestion {
  const data = expectRecord(value, path);
  return {
    id: expectUuid(data['id'], `${path}.id`),
    status: expectEnum(data['status'], Object.values(LibrarySuggestionStatus), `${path}.status`),
    createdAt: expectString(data['createdAt'], `${path}.createdAt`),
    libraryEditionSlug: data['libraryEditionSlug'] == null ? null : expectString(data['libraryEditionSlug'], `${path}.libraryEditionSlug`),
    libraryTitle: data['libraryTitle'] == null ? null : expectString(data['libraryTitle'], `${path}.libraryTitle`),
    libraryParallelLanguages: data['libraryParallelLanguages'] == null
      ? []
      : expectArray(data['libraryParallelLanguages'], `${path}.libraryParallelLanguages`)
        .map((language, index) => expectEnum(language, Object.values(LanguageCode), `${path}.libraryParallelLanguages[${index}]`)),
  };
}

const PROVENANCE_FIELDS: BookImportMetadataField[] = ['title', 'author', 'description', 'language', 'publication_year'];
const PROVENANCE_VALUES: BookImportProvenance[] = ['user', 'source', 'ai'];

function parseProvenance(value: unknown): BookImport['metadataProvenance'] {
  if (value === null || value === undefined) return {};
  const record = expectRecord(value, 'bookImport.metadataProvenance');
  const provenance: BookImport['metadataProvenance'] = {};
  for (const field of PROVENANCE_FIELDS) {
    const source = record[field];
    if (source !== undefined) {
      provenance[field] = expectEnum(source, PROVENANCE_VALUES, `bookImport.metadataProvenance.${field}`);
    }
  }
  return provenance;
}

export function parseBookImports(value: unknown): BookImport[] {
  if (!Array.isArray(value)) {
    throw new Error('bookImports must be an array');
  }
  return value.map(parseBookImport);
}

export function parseBookImportQuota(value: unknown): BookImportQuota {
  const data = expectRecord(value, 'bookImportQuota');
  return {
    limit: expectNumber(data['limit'], 'bookImportQuota.limit'),
    used: expectNumber(data['used'], 'bookImportQuota.used'),
    periodStartsAt: expectString(data['periodStartsAt'], 'bookImportQuota.periodStartsAt'),
    periodEndsAt: expectString(data['periodEndsAt'], 'bookImportQuota.periodEndsAt'),
  };
}
