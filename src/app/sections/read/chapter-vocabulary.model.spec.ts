import {parseChapterVocabulary, vocabularyDiscoverParams} from './chapter-vocabulary.model';

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
