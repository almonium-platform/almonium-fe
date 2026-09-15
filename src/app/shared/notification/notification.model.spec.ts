import {ApiContractError} from '../runtime-validation';
import {NotificationType, isBookNotification, parseNotifications} from './notification.model';

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
    senderUsername: 'familsubs',
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

  it('accepts a reading row, which has no sender and carries where it opens', () => {
    const [parsed] = parseNotifications([{
      ...notification,
      type: 'TRANSLATION_ORDER_COMPLETED',
      title: 'Effi Briest now reads alongside Ukrainian',
      message: 'You asked for it in August.',
      referenceId: 'order-id',
      senderId: null,
      senderUsername: null,
      actionPath: '/reader/effi-briest-de-original?parallel=UK',
      contextTitle: 'Effi Briest',
    }]);

    expect(parsed.senderId).toBeNull();
    expect(parsed.actionPath).toBe('/reader/effi-briest-de-original?parallel=UK');
    expect(parsed.contextTitle).toBe('Effi Briest');
    expect(isBookNotification(parsed)).toBeTrue();
    expect(isBookNotification({type: NotificationType.FRIENDSHIP_ACCEPTED})).toBeFalse();
  });

  it('tolerates a backend that does not send the reading fields yet', () => {
    const [parsed] = parseNotifications([notification]);
    expect(parsed.actionPath).toBeNull();
    expect(parsed.contextTitle).toBeNull();
  });
});
