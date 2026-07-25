import {LocalStorageService} from './local-storage.service';

describe('LocalStorageService user info migration', () => {
  const userInfoKey = 'user_info';
  const service = new LocalStorageService();

  afterEach(() => window.localStorage.removeItem(userInfoKey));

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
});
