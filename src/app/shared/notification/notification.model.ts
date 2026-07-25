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
  senderId: string;
}

export enum NotificationType {
  FRIENDSHIP_ACCEPTED = 'FRIENDSHIP_ACCEPTED',
  FRIENDSHIP_REQUESTED = 'FRIENDSHIP_REQUESTED',
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
      senderId: expectString(data['senderId'], `${path}.senderId`),
    };
  });
}
