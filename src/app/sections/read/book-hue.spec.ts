import {BOOK_HUES, bookColor, dominantHueOfPixels, hashedBookHue, hashedSpineWidth, snapBookHue} from './book-hue';

describe('book-hue', () => {
  it('hashes an id to one of the eight hues, and always the same one', () => {
    const hue = hashedBookHue('0198a0c5-2f5e-7b2a-9f0e-2f0c8d6f1a11');
    expect(BOOK_HUES).toContain(hue);
    expect(hashedBookHue('0198a0c5-2f5e-7b2a-9f0e-2f0c8d6f1a11')).toBe(hue);
  });

  it('spreads thickness between 34 and 66 pixels', () => {
    for (const id of ['a', 'frankenstein', 'effi-briest', '01989f47-4c2a-7a10-9e5b-751983624a25']) {
      const width = hashedSpineWidth(id);
      expect(width).toBeGreaterThanOrEqual(34);
      expect(width).toBeLessThanOrEqual(66);
    }
  });

  it('snaps a hue to the nearest palette entry on the shortest arc', () => {
    expect(snapBookHue(20)).toBe(15);
    expect(snapBookHue(350)).toBe(15);
    expect(snapBookHue(100)).toBe(85);
    expect(snapBookHue(-60)).toBe(285);
  });

  it('paints the palette at fixed lightness and chroma', () => {
    expect(bookColor(85)).toBe('oklch(0.6 0.09 85)');
  });

  it('finds the dominant saturated hue and ignores greys', () => {
    // Three grey pixels and one saturated blue one: the blue wins.
    const data = new Uint8ClampedArray([
      200, 200, 200, 255,
      120, 120, 120, 255,
      250, 250, 250, 255,
      20, 40, 220, 255,
    ]);
    expect(dominantHueOfPixels(data)).toBe(240);
  });

  it('returns null for an image with no colour', () => {
    expect(dominantHueOfPixels(new Uint8ClampedArray([128, 128, 128, 255]))).toBeNull();
  });
});
