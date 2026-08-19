import {avatarImageUrl, avatarLetter, isDefaultAvatar} from './avatar-display';

describe('avatar display', () => {
  it('uses the first Unicode letter or number from the username', () => {
    expect(avatarLetter('kuzanoleg')).toBe('K');
    expect(avatarLetter('__марія')).toBe('М');
    expect(avatarLetter('  7seas')).toBe('7');
  });

  it('falls back to a middot when the username has no letter or number', () => {
    expect(avatarLetter('---')).toBe('·');
    expect(avatarLetter(null)).toBe('·');
  });

  it('uses the cream engraving for a member default animal', () => {
    const freeUrl = 'https://example.test/assets/img/avatars/default/stag.png';

    expect(isDefaultAvatar(freeUrl)).toBeTrue();
    expect(avatarImageUrl(freeUrl, false)).toBe(freeUrl);
    expect(avatarImageUrl(freeUrl, true))
      .toBe('https://example.test/assets/img/avatars/default/premium/stag.png');
  });

  it('does not rewrite uploaded avatars', () => {
    const uploadedUrl = 'https://cdn.example.test/avatar.png';
    expect(isDefaultAvatar(uploadedUrl)).toBeFalse();
    expect(avatarImageUrl(uploadedUrl, true)).toBe(uploadedUrl);
  });
});
