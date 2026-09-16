import {bookPercentage, placeForPercentage, splitBookChapters} from './chapter-split';

describe('splitBookChapters', () => {
  it('keys each section by its heading sequence and drops the heading from the page', () => {
    const html = '<section class="chapter"><h2 class="chapter-title" id="chapter-3">LETTER I.</h2><p>Dear sister.</p></section>'
      + '<section class="chapter"><h2 class="chapter-title" id="chapter-11">CHAPTER V.</h2><p>It was a dreary night.</p><p>More.</p></section>';
    const chapters = splitBookChapters(html);
    expect(chapters.map(chapter => chapter.key)).toEqual([3, 11]);
    expect(chapters.map(chapter => chapter.title)).toEqual(['LETTER I.', 'CHAPTER V.']);
    expect(chapters[1].html).not.toContain('<h2');
    expect(chapters[1].html).toContain('It was a dreary night.');
    expect(chapters[1].weight).toBeGreaterThan(chapters[0].weight);
  });

  it('reads a document without chapter sections as one chapter', () => {
    const chapters = splitBookChapters('<p>One page.</p><p>Two.</p>');
    expect(chapters.length).toBe(1);
    expect(chapters[0].key).toBe(1);
    expect(chapters[0].html).toContain('One page.');
  });

  it('takes the title from the segment in the language being read', () => {
    const html = '<section class="chapter"><h2 id="chapter-1"><span class="seg-pair"><span class="segment" lang="en">Chapter One</span><span class="segment" lang="uk">Розділ перший</span></span></h2><p>x</p></section>';
    expect(splitBookChapters(html, 'uk')[0].title).toBe('Розділ перший');
    expect(splitBookChapters(html, 'en')[0].title).toBe('Chapter One');
  });
});

describe('book percentage', () => {
  const chapters = [
    {key: 1, title: 'a', html: '', weight: 100},
    {key: 2, title: 'b', html: '', weight: 300},
    {key: 3, title: 'c', html: '', weight: 600},
  ];

  it('weights chapters by their length in both directions', () => {
    expect(bookPercentage(chapters, 1, 0.5)).toBe(25);
    expect(bookPercentage(chapters, 2, 1)).toBe(100);
    expect(placeForPercentage(chapters, 25)).toEqual({index: 1, withinChapter: 0.5});
    expect(placeForPercentage(chapters, 0)).toEqual({index: 0, withinChapter: 0});
    expect(placeForPercentage(chapters, 100).index).toBe(2);
  });
});
