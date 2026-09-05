import {avatarHueClass, avatarHueToken, avatarImageUrl, avatarLetter, isDefaultAvatar, schematicAvatarUrl, usesSchematic} from './avatar-display';

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

  it('uses the same drawing file for every tier', () => {
    const freeUrl = 'https://example.test/assets/img/avatars/default/stag.png';

    expect(isDefaultAvatar(freeUrl)).toBeTrue();
    expect(avatarImageUrl(freeUrl)).toBe(freeUrl);
  });

  it('draws the schematic of a bundled animal below 48px, and nothing else has one', () => {
    expect(schematicAvatarUrl('https://example.test/assets/img/avatars/default/stag.png'))
      .toBe('assets/img/avatars/small/stag-small-plum.svg');
    expect(schematicAvatarUrl('https://cdn.example.test/avatar.png')).toBeNull();
    expect(schematicAvatarUrl(null)).toBeNull();

    expect(usesSchematic(40)).toBeTrue();
    expect(usesSchematic(48)).toBeFalse();
  });

  it('does not rewrite uploaded avatars', () => {
    const uploadedUrl = 'https://cdn.example.test/avatar.png';
    expect(isDefaultAvatar(uploadedUrl)).toBeFalse();
    expect(avatarImageUrl(uploadedUrl)).toBe(uploadedUrl);
  });

  it('holds a name in one of the four identity slots', () => {
    for (const name of ['familsubs', 'kuzanoleg', 'mirabel', 'olesya.r', '', '·']) {
      expect(avatarHueClass(name)).toMatch(/^avatar-hue-[1-4]$/);
      expect(avatarHueClass(name)).toBe(avatarHueClass(name));
    }
  });

  it('reads a slot fill and edge off the same hue', () => {
    const hue = avatarHueClass('kuzanoleg').slice(-1);

    expect(avatarHueToken('kuzanoleg', 'fill')).toBe(`var(--avatar-hue-${hue})`);
    expect(avatarHueToken('kuzanoleg', 'edge')).toBe(`var(--avatar-hue-${hue}-edge)`);
  });
});
