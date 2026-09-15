import {segmentAlmoText} from './almo-text-segments';

describe('segmentAlmoText', () => {
  it('leaves a bubble with no marks whole', () => {
    expect(segmentAlmoText('Und?', [], [])).toEqual([{text: 'Und?', kind: 'plain'}]);
    expect(segmentAlmoText('', ['x'], [])).toEqual([]);
  });

  it('dots a queue word in the exact form the server named, and only as a whole word', () => {
    const segments = segmentAlmoText('Du hattest dir vorgenommen, dabeizusein. Und dabei?', ['vorgenommen', 'dabei'], []);

    expect(segments).toEqual([
      {text: 'Du hattest dir ', kind: 'plain'},
      {text: 'vorgenommen', kind: 'word'},
      {text: ', dabeizusein. Und ', kind: 'plain'},
      {text: 'dabei', kind: 'word'},
      {text: '?', kind: 'plain'},
    ]);
  });

  it('marks both members of the contrast pair in plum and matches them case-insensitively', () => {
    const segments = segmentAlmoText('Fast. Besitzen ist für Dinge. Eine Sprache beherrscht man.', [], ['besitzen', 'beherrscht']);

    expect(segments.filter(segment => segment.kind === 'contrast').map(segment => segment.text))
      .toEqual(['Besitzen', 'beherrscht']);
  });

  it('prefers the longer form where one contains another', () => {
    const segments = segmentAlmoText('Ich habe mir das vorgenommen.', ['vorgenommen', 'mir das vorgenommen'], []);

    expect(segments.find(segment => segment.kind === 'word')?.text).toBe('mir das vorgenommen');
  });

  it('treats the marks as text, not patterns', () => {
    expect(segmentAlmoText('a (b) c', ['(b)'], [])).toEqual([
      {text: 'a ', kind: 'plain'},
      {text: '(b)', kind: 'word'},
      {text: ' c', kind: 'plain'},
    ]);
  });
});
