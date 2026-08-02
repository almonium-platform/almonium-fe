import {LanguageCode} from '../../models/language.enum';
import {expectEnum, expectNumber, expectRecord, expectString, expectUuid} from '../../shared/runtime-validation';

export enum BookImportStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
}

export interface BookImport {
  id: string;
  title: string;
  author: string;
  description: string;
  language: LanguageCode;
  publicationYear: number | null;
  status: BookImportStatus;
  progress: number;
  wordCount: number;
  error: string;
}

export function parseBookImport(value: unknown): BookImport {
  const data = expectRecord(value, 'bookImport');
  return {
    id: expectUuid(data['id'], 'bookImport.id'),
    title: expectString(data['title'], 'bookImport.title'),
    author: expectString(data['author'], 'bookImport.author'),
    description: expectString(data['description'], 'bookImport.description'),
    language: expectEnum(data['language'], Object.values(LanguageCode), 'bookImport.language'),
    publicationYear: data['publicationYear'] === null
      ? null
      : expectNumber(data['publicationYear'], 'bookImport.publicationYear'),
    status: expectEnum(data['status'], Object.values(BookImportStatus), 'bookImport.status'),
    progress: expectNumber(data['progress'], 'bookImport.progress'),
    wordCount: expectNumber(data['wordCount'], 'bookImport.wordCount'),
    error: expectString(data['error'], 'bookImport.error'),
  };
}
