import {ApiContractError} from '../runtime-validation';
import {NotificationType, parseNotifications} from './notification.model';

describe('notification API runtime validation', () => {
  const notification = {
    id: 'notification-id',
    type: NotificationType.FRIENDSHIP_REQUESTED,
    title: 'Friend request',
    message: null,
    createdAt: '2026-07-25T10:00:00Z',
    readAt: null,
    referenceId: 'relationship-id',
    pictureUrl: null,
    senderId: 'sender-id',
  };

  it('converts valid timestamps at the boundary', () => {
    const [parsed] = parseNotifications([{
      ...notification,
      readAt: '2026-07-25T11:00:00Z',
    }]);

    expect(parsed.createdAt).toBe('2026-07-25T10:00:00.000Z');
    expect(parsed.readAt).toEqual(new Date('2026-07-25T11:00:00Z'));
  });

  it('rejects invalid timestamps', () => {
    expect(() => parseNotifications([{...notification, createdAt: 'not-a-date'}]))
      .toThrowError(ApiContractError);
  });
});
