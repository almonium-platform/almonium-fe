import {CEFRLevel} from "../../models/userinfo.model";
import {LanguageCode} from "../../models/language.enum";
import {
  expectArray,
  expectBoolean,
  expectEnum,
  expectNullableNumber,
  expectNumber,
  expectRecord,
  expectString,
  expectUuid,
} from '../../shared/runtime-validation';

export interface Book {
  id: string;
  editionSlug: string;
  workSlug: string;
  title: string;
  author: string;
  description: string;
  publicationYear: number;
  coverUrl: string | null;
  wordCount: number;
  language: LanguageCode;
  cefrLevel: CEFRLevel;
  progressPercentage: number | null;
  isTranslation: boolean;
  hasParallelTranslation: boolean;
  hasTranslation: boolean;
  languageVariants: BookLanguageVariant[];
  favorite: boolean;
  orderLanguage?: LanguageCode;
  originalLanguage?: LanguageCode;
  originalId?: string;
  translator?: string;
}

export interface BookMiniDetails {
  progressPercentage: number;
  languageVariants: BookLanguageVariant[];
  language: LanguageCode;
}

export interface BookLanguageVariant {
  id: string;
  editionSlug: string;
  language: LanguageCode;
}

export interface BookshelfView {
  continueReading: Book[];
  available: Book[];
  favorites: Book[];
}

export function parseBookshelfView(value: unknown): BookshelfView {
  const data = expectRecord(value, 'bookshelf');
  return {
    continueReading: parseBookArray(data['continueReading'], 'bookshelf.continueReading'),
    available: parseBookArray(data['available'], 'bookshelf.available'),
    favorites: parseBookArray(data['favorites'], 'bookshelf.favorites'),
  };
}

export function parseBooks(value: unknown): Book[] {
  return parseBookArray(value, 'books');
}

export function parseBookMiniDetails(value: unknown): BookMiniDetails {
  const data = expectRecord(value, 'book');
  return {
    progressPercentage: expectNumber(data['progressPercentage'], 'book.progressPercentage'),
    language: expectEnum(data['language'], Object.values(LanguageCode), 'book.language'),
    languageVariants: parseLanguageVariants(data['languageVariants'], 'book.languageVariants'),
  };
}

export function parseBook(value: unknown, path = 'book'): Book {
  const data = expectRecord(value, path);
  return {
    id: expectUuid(data['id'], `${path}.id`),
    editionSlug: expectString(data['editionSlug'], `${path}.editionSlug`),
    workSlug: expectString(data['workSlug'], `${path}.workSlug`),
    title: expectString(data['title'], `${path}.title`),
    author: expectString(data['author'], `${path}.author`),
    description: data['description'] === null
      ? ''
      : expectString(data['description'], `${path}.description`),
    publicationYear: expectNumber(data['publicationYear'], `${path}.publicationYear`),
    coverUrl: data['coverUrl'] === null
      ? null
      : expectString(data['coverUrl'], `${path}.coverUrl`),
    wordCount: expectNumber(data['wordCount'], `${path}.wordCount`),
    language: expectEnum(data['language'], Object.values(LanguageCode), `${path}.language`),
    cefrLevel: expectEnum(data['cefrLevel'], Object.values(CEFRLevel), `${path}.cefrLevel`),
    progressPercentage: expectNullableNumber(data['progressPercentage'], `${path}.progressPercentage`),
    isTranslation: expectBoolean(data['isTranslation'], `${path}.isTranslation`),
    hasParallelTranslation: expectBoolean(
      data['hasParallelTranslation'],
      `${path}.hasParallelTranslation`,
    ),
    hasTranslation: expectBoolean(data['hasTranslation'], `${path}.hasTranslation`),
    languageVariants: data['languageVariants'] === undefined
      ? []
      : parseLanguageVariants(data['languageVariants'], `${path}.languageVariants`),
    favorite: data['favorite'] === undefined
      ? false
      : expectBoolean(data['favorite'], `${path}.favorite`),
    ...optionalEnum(data['orderLanguage'], Object.values(LanguageCode), 'orderLanguage', path),
    ...optionalEnum(data['originalLanguage'], Object.values(LanguageCode), 'originalLanguage', path),
    ...optionalUuid(data['originalId'], 'originalId', path),
    ...optionalString(data['translator'], 'translator', path),
  };
}

function parseBookArray(value: unknown, path: string): Book[] {
  return expectArray(value, path).map((book, index) => parseBook(book, `${path}[${index}]`));
}

function parseLanguageVariants(value: unknown, path: string): BookLanguageVariant[] {
  return expectArray(value, path).map((variant, index) => {
    const itemPath = `${path}[${index}]`;
    const data = expectRecord(variant, itemPath);
    return {
      id: expectUuid(data['id'], `${itemPath}.id`),
      editionSlug: expectString(data['editionSlug'], `${itemPath}.editionSlug`),
      language: expectEnum(data['language'], Object.values(LanguageCode), `${itemPath}.language`),
    };
  });
}

function optionalString(
  value: unknown,
  key: 'translator',
  path: string,
): Partial<Pick<Book, 'translator'>> {
  return value === null || value === undefined
    ? {}
    : {[key]: expectString(value, `${path}.${key}`)};
}

function optionalUuid(
  value: unknown,
  key: 'originalId',
  path: string,
): Partial<Pick<Book, 'originalId'>> {
  return value === null || value === undefined
    ? {}
    : {[key]: expectUuid(value, `${path}.${key}`)};
}

function optionalEnum<K extends 'orderLanguage' | 'originalLanguage'>(
  value: unknown,
  values: readonly LanguageCode[],
  key: K,
  path: string,
): Partial<Pick<Book, K>> {
  return value === null || value === undefined
    ? {}
    : {[key]: expectEnum(value, values, `${path}.${key}`)} as Partial<Pick<Book, K>>;
}
