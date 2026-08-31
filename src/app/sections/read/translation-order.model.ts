import {LanguageCode} from '../../models/language.enum';
import {
  expectArray,
  expectEnum,
  expectRecord,
  expectString,
  expectUuid,
} from '../../shared/runtime-validation';

export enum TranslationOrderStatus {
  ASKED = 'ASKED',
  READY = 'READY',
}

/**
 * A translation the reader asked for. Requests are keyed by book and language, so one
 * reader can have several open on the same book, each costing a slot of the monthly
 * allowance. `bookId` is always the original edition, never a translation of it.
 */
export interface TranslationOrder {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  language: LanguageCode;
  status: TranslationOrderStatus;
  fulfilledBookId: string | null;
  createdAt: string;
}

export function parseTranslationOrders(value: unknown): TranslationOrder[] {
  return expectArray(value, 'translationOrders')
    .map((order, index) => parseTranslationOrder(order, `translationOrders[${index}]`));
}

export function parseTranslationOrder(value: unknown, path = 'translationOrder'): TranslationOrder {
  const data = expectRecord(value, path);
  return {
    id: expectUuid(data['id'], `${path}.id`),
    bookId: expectUuid(data['bookId'], `${path}.bookId`),
    bookTitle: expectString(data['bookTitle'], `${path}.bookTitle`),
    bookAuthor: expectString(data['bookAuthor'], `${path}.bookAuthor`),
    language: expectEnum(data['language'], Object.values(LanguageCode), `${path}.language`),
    status: expectEnum(data['status'], Object.values(TranslationOrderStatus), `${path}.status`),
    fulfilledBookId: data['fulfilledBookId'] === null || data['fulfilledBookId'] === undefined
      ? null
      : expectUuid(data['fulfilledBookId'], `${path}.fulfilledBookId`),
    createdAt: expectString(data['createdAt'], `${path}.createdAt`),
  };
}
