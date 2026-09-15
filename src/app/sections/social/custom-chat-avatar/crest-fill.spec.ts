import {crestFill} from './crest-fill';

function parse(fill: string): {lightness: number; chroma: number; hue: number} {
  const [lightness, chroma, hue] = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(fill)!.slice(1).map(Number);
  return {lightness, chroma, hue};
}

describe('crest fill', () => {
  it('keeps the stored colour\'s hue and holds chroma at 0.10', () => {
    // #a11d1d is the language\'s own colour, and the disc stays on its side of the wheel.
    const {chroma, hue} = parse(crestFill('#a11d1d', false));

    expect(chroma).toBe(0.1);
    expect(hue).toBeCloseTo(26.9, 1);
  });

  it('reproduces the legacy English plum from the stored colour alone', () => {
    expect(crestFill('#6E2A5E', false)).toBe('oklch(0.402 0.1 337.7)');
  });

  it('leaves a stored lightness that is already inside the band where it is', () => {
    expect(parse(crestFill('#a11d1d', false)).lightness).toBeCloseTo(0.461, 3);
  });

  it('clamps a light stored colour down into the band rather than repainting it', () => {
    // #bcbf53 is a pale olive: cream on it is unreadable until the disc comes down to the band.
    expect(parse(crestFill('#bcbf53', false)).lightness).toBe(0.48);
  });

  it('clamps a dark stored colour up to the floor of the band', () => {
    expect(parse(crestFill('#402aa3', false)).lightness).toBe(0.4);
  });

  it('darkens in steps of 0.03 until cream passes 4.5:1 instead of switching to ink', () => {
    // On dark the band is a flat 0.55, which leaves cream at 4.04:1 - one step down clears it.
    for (const stored of ['#a11d1d', '#bcbf53', '#402aa3', '#6E2A5E']) {
      expect(parse(crestFill(stored, true)).lightness).toBe(0.52);
    }
  });

  it('falls back to the colour the navbar uses for a language with none stored', () => {
    expect(crestFill(undefined, false)).toBe(crestFill('#7A6BB8', false));
    expect(crestFill('not a colour', false)).toBe(crestFill('#7A6BB8', false));
  });
});
