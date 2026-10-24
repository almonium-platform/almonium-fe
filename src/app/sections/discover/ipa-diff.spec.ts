import {diffTranscriptions, phonemes, sameTranscriptions} from './ipa-diff';

describe('IPA diff', () => {
  const tinted = (transcriptions: string[]) =>
    diffTranscriptions(transcriptions).map(line => line.segments.filter(segment => segment.differs).map(segment => segment.text));

  it('tints only the sounds that part, in both lines, and keeps the delimiters', () => {
    const [british, american] = diffTranscriptions(['/ˈklɪə/', '/ˈklɪɹ/']);
    expect(british.open + british.close).toBe('//');
    expect(british.segments).toEqual([{text: 'ˈklɪ', differs: false}, {text: 'ə', differs: true}]);
    expect(american.segments).toEqual([{text: 'ˈklɪ', differs: false}, {text: 'ɹ', differs: true}]);
  });

  it('compares a diphthong as one phoneme, not letter by letter', () => {
    expect(tinted(['/noʊ/', '/nəʊ/'])).toEqual([['oʊ'], ['əʊ']]);
  });

  it('reads ɹ and r as one sound', () => {
    expect(tinted(['/ɹiːd/', '/riːd/'])).toEqual([[], []]);
    expect(sameTranscriptions(['/ɹiːd/', '/riːd/'])).toBeTrue();
    expect(sameTranscriptions(['/ˈklɪə/', '/ˈklɪɹ/'])).toBeFalse();
  });

  it('keeps diacritics, length and tie bars on their symbol', () => {
    expect(phonemes('t͡ʃiːz')).toEqual(['t͡ʃ', 'iː', 'z']);
    expect(phonemes('haɪ̯s')).toEqual(['h', 'aɪ̯', 's']);
  });

  it('gives the first line every difference any other line has with it', () => {
    expect(tinted(['/a/', '/a/', '/b/'])).toEqual([['a'], [], ['b']]);
  });
});
