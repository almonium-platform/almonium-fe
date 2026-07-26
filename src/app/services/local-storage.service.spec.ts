import {LocalStorageService} from './local-storage.service';

describe('LocalStorageService user info migration', () => {
  const userInfoKey = 'user_info';
  const readerPositionsKey = 'reader_positions';
  const service = new LocalStorageService();

  afterEach(() => {
    window.localStorage.removeItem(userInfoKey);
    window.localStorage.removeItem(readerPositionsKey);
  });

  it('removes a Stream token persisted by an older client', () => {
    window.localStorage.setItem(userInfoKey, JSON.stringify({
      id: 'user-1',
      username: 'reader',
      streamChatToken: 'legacy-secret',
    }));

    const userInfo = service.getUserInfo();
    const persisted = JSON.parse(window.localStorage.getItem(userInfoKey)!) as Record<string, unknown>;

    expect(userInfo?.id).toBe('user-1');
    expect(Object.hasOwn(persisted, 'streamChatToken')).toBeFalse();
  });

  it('clears device-specific reader positions with user data', () => {
    window.localStorage.setItem(readerPositionsKey, JSON.stringify({'user-1:1:base': {scrollTop: 42}}));

    service.clearUserRelatedData();

    expect(window.localStorage.getItem(readerPositionsKey)).toBeNull();
  });
});
