import {parseChapterVocabulary, vocabularyDiscoverParams, wordExcerpt} from './chapter-vocabulary.model';

describe('chapter vocabulary contract', () => {
  const word = {lemma: 'lantern', surface: 'lanterns', context: 'Two lanterns burned.', blockId: 'c11.p1'};
  const data = {chapterId: '01989f47-4c2a-7a10-9e5b-751983624a25', chapterSequence: 11, language: 'en', status: 'ready', words: [word]};

  it('preserves the attested form and source context rather than generating either', () => {
    expect(parseChapterVocabulary(data).words).toEqual([word]);
  });
  it('never presents stale words, and rejects an invalid status', () => {
    expect(parseChapterVocabulary({...data, status: 'stale'}).words).toEqual([]);
    expect(() => parseChapterVocabulary({...data, status: 'guess'})).toThrow();
  });
  it('carries the source language and book/chapter context into Discover', () => {
    expect(vocabularyDiscoverParams(word, parseChapterVocabulary(data), 'original-en', 'Book', 'V')).toEqual({
      text: 'lantern', context: 'Two lanterns burned.', language: 'EN', book: 'original-en', bookTitle: 'Book', chapter: 11, chapterTitle: 'V', block: 'c11.p1',
    });
  });
});

describe('wordExcerpt', () => {
  it('cuts the excerpt at sentence boundaries around the observed form and marks it', () => {
    const word = {lemma: 'countenance', surface: 'countenance', context: 'Oh, no mortal could support the horror of that countenance. A mummy again endued with animation could not be so hideous.', blockId: 'c11.p6'};
    expect(wordExcerpt(word)).toEqual([
      {text: 'Oh, no mortal could support the horror of that ', hit: false},
      {text: 'countenance', hit: true},
      {text: '.', hit: false},
    ]);
  });
  it('highlights the observed form, not the lemma, and keeps the whole context when the form is absent', () => {
    const word = {lemma: 'endeavour', surface: 'endeavoured', context: '…the wretch whom I had endeavoured to form? His limbs were in proportion.', blockId: 'c11.p4'};
    expect(wordExcerpt(word).find(part => part.hit)?.text).toBe('endeavoured');
    expect(wordExcerpt(word).map(part => part.text).join('')).toBe('…the wretch whom I had endeavoured to form?');
    expect(wordExcerpt({...word, surface: 'absent'})).toEqual([{text: word.context, hit: false}]);
  });
});
