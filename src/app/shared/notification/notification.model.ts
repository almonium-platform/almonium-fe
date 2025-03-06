export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  createdAt: string;
  readAt: Date | null;
  referenceId: string;
  pictureUrl: string;
}

export enum NotificationType {
  FRIENDSHIP_ACCEPTED = 'FRIENDSHIP_ACCEPTED',
  FRIENDSHIP_REQUESTED = 'FRIENDSHIP_REQUESTED',
}
