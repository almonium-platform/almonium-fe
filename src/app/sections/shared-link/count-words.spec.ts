import {capitalise, numberInWords, wordsAsLabel, wordsInProse} from './count-words';

describe('count words', () => {
  it('spells out counts for prose', () => {
    expect(numberInWords(0)).toBe('zero');
    expect(numberInWords(1)).toBe('one');
    expect(numberInWords(13)).toBe('thirteen');
    expect(numberInWords(20)).toBe('twenty');
    expect(numberInWords(24)).toBe('twenty-four');
    expect(numberInWords(99)).toBe('ninety-nine');
  });

  it('falls back to numerals past what reads well', () => {
    expect(numberInWords(100)).toBe('100');
    expect(numberInWords(240)).toBe('240');
  });

  it('agrees the noun with the count', () => {
    expect(capitalise(wordsInProse(24))).toBe('Twenty-four words');
    expect(wordsInProse(1)).toBe('one word');
    expect(wordsAsLabel(1)).toBe('1 word');
    expect(wordsAsLabel(18)).toBe('18 words');
  });
});
