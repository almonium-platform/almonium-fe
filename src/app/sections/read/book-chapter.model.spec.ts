import {chapterLevelRange, displayChapterTitle, parseBookChapters} from './book-chapter.model';

describe('parseBookChapters', () => {
  it('accepts the public projection and rejects an unknown level', () => {
    const chapter = {id: '01989f47-4c2a-7a10-9e5b-751983624a25', sequence: 3, title: 'LETTER I.', analysisStatus: 'complete', cefrEstimate: 'B2', descriptions: ['An explorer writes home.']};
    expect(parseBookChapters([chapter])[0].cefrEstimate).toBe('B2');
    expect(() => parseBookChapters([{...chapter, cefrEstimate: 'D1'}])).toThrow();
  });
});

describe('displayChapterTitle', () => {
  it('drops the trailing full stop and the shouting caps, keeping roman numerals', () => {
    expect(displayChapterTitle('CHAPTER V.')).toBe('Chapter V');
    expect(displayChapterTitle('LETTER II.')).toBe('Letter II');
    expect(displayChapterTitle('INTRODUCTION.')).toBe('Introduction');
    expect(displayChapterTitle('  CHAPTER   XXIV. ')).toBe('Chapter XXIV');
  });

  it('leaves a mixed-case title as the source wrote it', () => {
    expect(displayChapterTitle('The road to Ingolstadt.')).toBe('The road to Ingolstadt');
    expect(displayChapterTitle('Розділ I.')).toBe('Розділ I');
  });
});

describe('chapterLevelRange', () => {
  const chapter = (cefrEstimate: string | null) => ({id: '01989f47-4c2a-7a10-9e5b-751983624a25', sequence: 1, title: 'x', analysisStatus: 'complete', cefrEstimate, descriptions: []});

  it('spans the lowest and highest estimate and ignores chapters without one', () => {
    expect(chapterLevelRange([chapter('C1'), chapter(null), chapter('B1'), chapter('B2')])).toBe('B1–C1');
    expect(chapterLevelRange([chapter('B2'), chapter('B2')])).toBe('B2');
    expect(chapterLevelRange([chapter(null)])).toBeNull();
  });
});
