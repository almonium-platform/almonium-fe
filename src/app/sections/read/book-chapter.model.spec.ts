import {parseBookChapters} from './book-chapter.model';

describe('chapter contract', () => {
  const chapter = {id: '01989f47-4c2a-7a10-9e5b-751983624a25', sequence: 10, title: 'IV', analysisStatus: 'complete', cefrEstimate: 'B2', descriptions: ['A difficult choice.']};
  it('preserves chapter sequence and estimate separately from edition level', () => {
    expect(parseBookChapters([chapter])).toEqual([chapter]);
  });
  it('allows unavailable estimates, but rejects malformed data', () => {
    expect(parseBookChapters([{...chapter, cefrEstimate: null}])[0].cefrEstimate).toBeNull();
    expect(() => parseBookChapters([{...chapter, cefrEstimate: 'easy'}])).toThrow();
    expect(() => parseBookChapters([{...chapter, descriptions: [42]}])).toThrow();
  });
});
