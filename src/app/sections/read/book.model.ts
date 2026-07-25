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
} from '../../shared/runtime-validation';

export interface Book {
  id: number;
  title: string;
  author: string;
  publicationYear: number;
  coverImageUrl: string;
  wordCount: number;
  rating: number;
  language: LanguageCode;
  levelFrom: CEFRLevel;
  levelTo: CEFRLevel;
  progressPercentage: number | null;
  isTranslation: boolean;
  hasParallelTranslation: boolean;
  hasTranslation: boolean;
  description: string;
  languageVariants: BookLanguageVariant[];
  favorite: boolean;
  orderLanguage?: LanguageCode;
  originalLanguage?: LanguageCode;
  originalId?: number;
  translator?: string;
}

export interface BookMiniDetails {
  progressPercentage: number;
  languageVariants: BookLanguageVariant[];
  language: LanguageCode;
}

export interface BookLanguageVariant {
  id: number;
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
    id: expectNumber(data['id'], `${path}.id`),
    title: expectString(data['title'], `${path}.title`),
    author: expectString(data['author'], `${path}.author`),
    publicationYear: expectNumber(data['publicationYear'], `${path}.publicationYear`),
    coverImageUrl: expectString(data['coverImageUrl'], `${path}.coverImageUrl`),
    wordCount: expectNumber(data['wordCount'], `${path}.wordCount`),
    rating: expectNumber(data['rating'], `${path}.rating`),
    language: expectEnum(data['language'], Object.values(LanguageCode), `${path}.language`),
    levelFrom: expectEnum(data['levelFrom'], Object.values(CEFRLevel), `${path}.levelFrom`),
    levelTo: expectEnum(data['levelTo'], Object.values(CEFRLevel), `${path}.levelTo`),
    progressPercentage: expectNullableNumber(data['progressPercentage'], `${path}.progressPercentage`),
    isTranslation: expectBoolean(data['isTranslation'], `${path}.isTranslation`),
    hasParallelTranslation: expectBoolean(
      data['hasParallelTranslation'],
      `${path}.hasParallelTranslation`,
    ),
    hasTranslation: expectBoolean(data['hasTranslation'], `${path}.hasTranslation`),
    description: data['description'] === undefined
      ? ''
      : expectString(data['description'], `${path}.description`),
    languageVariants: data['languageVariants'] === undefined
      ? []
      : parseLanguageVariants(data['languageVariants'], `${path}.languageVariants`),
    favorite: data['favorite'] === undefined
      ? false
      : expectBoolean(data['favorite'], `${path}.favorite`),
    ...optionalEnum(data['orderLanguage'], Object.values(LanguageCode), 'orderLanguage', path),
    ...optionalEnum(data['originalLanguage'], Object.values(LanguageCode), 'originalLanguage', path),
    ...optionalNumber(data['originalId'], 'originalId', path),
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
      id: expectNumber(data['id'], `${itemPath}.id`),
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

function optionalNumber(
  value: unknown,
  key: 'originalId',
  path: string,
): Partial<Pick<Book, 'originalId'>> {
  return value === null || value === undefined
    ? {}
    : {[key]: expectNumber(value, `${path}.${key}`)};
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
