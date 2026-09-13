import {LanguageCode} from '../../models/language.enum';
import {
  expectArray,
  expectEnum,
  expectNumber,
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
 * A declined request never reaches the client: it disappears with a plain mail.
 */
export interface TranslationOrder {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  /** The original edition's slug, for the link back to the book page. */
  bookEditionSlug: string;
  language: LanguageCode;
  status: TranslationOrderStatus;
  fulfilledBookId: string | null;
  /** The slug of the translated edition once the request is READY. */
  fulfilledEditionSlug: string | null;
  createdAt: string;
  /** When the reader saw the fulfilment notice; null keeps the notice on the Read page. */
  seenAt: string | null;
}

/** The caller's monthly allowance: `limit` below zero means unlimited. */
export interface TranslationRequestQuota {
  limit: number;
  used: number;
  periodStartsAt: string;
  periodEndsAt: string;
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
    bookEditionSlug: nullableString(data['bookEditionSlug'], `${path}.bookEditionSlug`) ?? '',
    language: expectEnum(data['language'], Object.values(LanguageCode), `${path}.language`),
    status: expectEnum(data['status'], Object.values(TranslationOrderStatus), `${path}.status`),
    fulfilledBookId: data['fulfilledBookId'] === null || data['fulfilledBookId'] === undefined
      ? null
      : expectUuid(data['fulfilledBookId'], `${path}.fulfilledBookId`),
    fulfilledEditionSlug: nullableString(data['fulfilledEditionSlug'], `${path}.fulfilledEditionSlug`),
    createdAt: expectString(data['createdAt'], `${path}.createdAt`),
    seenAt: nullableString(data['seenAt'], `${path}.seenAt`),
  };
}

export function parseTranslationRequestQuota(value: unknown): TranslationRequestQuota {
  const data = expectRecord(value, 'translationRequestQuota');
  return {
    limit: expectNumber(data['limit'], 'translationRequestQuota.limit'),
    used: expectNumber(data['used'], 'translationRequestQuota.used'),
    periodStartsAt: expectString(data['periodStartsAt'], 'translationRequestQuota.periodStartsAt'),
    periodEndsAt: expectString(data['periodEndsAt'], 'translationRequestQuota.periodEndsAt'),
  };
}

function nullableString(value: unknown, path: string): string | null {
  return value === null || value === undefined ? null : expectString(value, path);
}
