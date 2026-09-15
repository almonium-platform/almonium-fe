import {applyMotionPreference, resolveReducedMotion} from './motion-preference';

describe('motion preference', () => {
  it('uses the operating-system preference until the user overrides it', () => {
    expect(resolveReducedMotion(null, {matches: true})).toBeTrue();
    expect(resolveReducedMotion({}, {matches: false})).toBeFalse();
  });

  it('allows an explicit override in either direction', () => {
    expect(resolveReducedMotion({reduceMotion: false}, {matches: true})).toBeFalse();
    expect(resolveReducedMotion({reduceMotion: true}, {matches: false})).toBeTrue();
  });

  it('writes the resolved state to the root motion attribute', () => {
    const root = document.createElement('html');
    applyMotionPreference(root, true);
    expect(root.dataset['motion']).toBe('reduced');
    applyMotionPreference(root, false);
    expect(root.dataset['motion']).toBe('full');
  });
});
