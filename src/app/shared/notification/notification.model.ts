import {
  expectArray,
  expectDate,
  expectEnum,
  expectNullableString,
  expectRecord,
  expectString,
} from '../runtime-validation';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  createdAt: string;
  readAt: Date | null;
  referenceId: string;
  pictureUrl: string | null;
  /** Null for a row the product sent itself: a book that became ready has no sender. */
  senderId: string | null;
  /* Nullable so a client that reaches the API before it ships the field keeps its old
     behaviour - the avatar's placeholder mark - instead of failing the whole panel. */
  senderUsername: string | null;
  /** Where tapping the row goes; null for rows the client routes by type. */
  actionPath: string | null;
  /** The book a reading row is about, for the cover tile in the avatar slot. */
  contextTitle: string | null;
}

export enum NotificationType {
  FRIENDSHIP_ACCEPTED = 'FRIENDSHIP_ACCEPTED',
  FRIENDSHIP_REQUESTED = 'FRIENDSHIP_REQUESTED',
  TRANSLATION_ORDER_COMPLETED = 'TRANSLATION_ORDER_COMPLETED',
  LIBRARY_SUGGESTION_PUBLISHED = 'LIBRARY_SUGGESTION_PUBLISHED',
  BOOK_IMPORT_READY = 'BOOK_IMPORT_READY',
  BOOK_IMPORT_FAILED = 'BOOK_IMPORT_FAILED',
}

const BOOK_TYPES: readonly NotificationType[] = [
  NotificationType.TRANSLATION_ORDER_COMPLETED,
  NotificationType.LIBRARY_SUGGESTION_PUBLISHED,
  NotificationType.BOOK_IMPORT_READY,
  NotificationType.BOOK_IMPORT_FAILED,
];

/** A reading row: the avatar slot carries the book's cover tile instead of a face. */
export function isBookNotification(notification: Pick<Notification, 'type'>): boolean {
  return BOOK_TYPES.includes(notification.type);
}

export function parseNotifications(value: unknown): Notification[] {
  return expectArray(value, 'notifications').map((item, index) => {
    const path = `notifications[${index}]`;
    const data = expectRecord(item, path);
    return {
      id: expectString(data['id'], `${path}.id`),
      type: expectEnum(data['type'], Object.values(NotificationType), `${path}.type`),
      title: expectString(data['title'], `${path}.title`),
      message: expectNullableString(data['message'], `${path}.message`),
      createdAt: expectDate(data['createdAt'], `${path}.createdAt`).toISOString(),
      readAt: data['readAt'] === null ? null : expectDate(data['readAt'], `${path}.readAt`),
      referenceId: expectString(data['referenceId'], `${path}.referenceId`),
      pictureUrl: expectNullableString(data['pictureUrl'], `${path}.pictureUrl`),
      senderId: expectNullableString(data['senderId'], `${path}.senderId`),
      senderUsername: expectNullableString(data['senderUsername'], `${path}.senderUsername`),
      actionPath: data['actionPath'] === undefined ? null : expectNullableString(data['actionPath'], `${path}.actionPath`),
      contextTitle: data['contextTitle'] === undefined ? null : expectNullableString(data['contextTitle'], `${path}.contextTitle`),
    };
  });
}
