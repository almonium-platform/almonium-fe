/** One chapter of a loaded book: its own page in the reader. */
export interface ChapterPage {
  /** The processor sequence when the heading carries one (`chapter-11`), else the 1-based order. */
  key: number;
  title: string;
  /** The chapter's markup without its heading; the page header shows the title instead. */
  html: string;
  /** Text length, the share of the book this chapter stands for in the saved percentage. */
  weight: number;
}

/**
 * Splits a book document into its chapter sections. A document without chapter sections is one
 * chapter, so a plain private import still reads. The heading's language segment picks the title
 * when the document is a parallel pair.
 */
export function splitBookChapters(html: string, targetLanguage: string | null = null): ChapterPage[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const sections = Array.from(doc.querySelectorAll<HTMLElement>('section.chapter'));
  if (sections.length === 0) {
    const body = doc.body;
    const heading = body.querySelector<HTMLElement>('h2[id], h1');
    const title = headingTitle(heading, targetLanguage, 1);
    heading?.remove();
    return [{key: 1, title, html: body.innerHTML, weight: Math.max(1, body.textContent?.trim().length ?? 0)}];
  }
  const used = new Set<number>();
  return sections.map((section, index) => {
    const heading = section.querySelector<HTMLElement>('h2[id]') ?? section.querySelector<HTMLElement>('h2, h1');
    const fromId = /^chapter-(\d+)$/.exec(heading?.id ?? '');
    let key = fromId ? Number(fromId[1]) : index + 1;
    if (used.has(key)) key = index + 1;
    used.add(key);
    const title = headingTitle(heading, targetLanguage, index + 1);
    const weight = Math.max(1, section.textContent?.trim().length ?? 0);
    heading?.remove();
    return {key, title, html: section.outerHTML, weight};
  });
}

function headingTitle(heading: HTMLElement | null, targetLanguage: string | null, ordinal: number): string {
  const segment = targetLanguage && heading
    ? heading.querySelector<HTMLElement>(`span.segment[lang="${CSS.escape(targetLanguage)}"]`)
    : null;
  const raw = [segment?.textContent, heading?.textContent].find(candidate => candidate?.trim());
  return raw ? raw.replace(/\s+/g, ' ').trim() : $localize`Chapter ${ordinal}:number:`;
}

/** Whole-book progress, as the server keeps it, from a place within one chapter. */
export function bookPercentage(chapters: ChapterPage[], index: number, withinChapter: number): number {
  const total = chapters.reduce((sum, chapter) => sum + chapter.weight, 0);
  if (total === 0 || index < 0 || index >= chapters.length) return 0;
  const before = chapters.slice(0, index).reduce((sum, chapter) => sum + chapter.weight, 0);
  const fraction = Math.max(0, Math.min(1, withinChapter));
  return Math.max(0, Math.min(100, (before + fraction * chapters[index].weight) / total * 100));
}

/** The chapter that holds a whole-book percentage, and how far into it the place is. */
export function placeForPercentage(chapters: ChapterPage[], percentage: number): {index: number; withinChapter: number} {
  const total = chapters.reduce((sum, chapter) => sum + chapter.weight, 0);
  if (chapters.length === 0) return {index: 0, withinChapter: 0};
  const target = Math.max(0, Math.min(100, percentage)) / 100 * total;
  let before = 0;
  for (let index = 0; index < chapters.length; index++) {
    const weight = chapters[index].weight;
    if (target < before + weight || index === chapters.length - 1) {
      return {index, withinChapter: Math.max(0, Math.min(1, (target - before) / weight))};
    }
    before += weight;
  }
  return {index: chapters.length - 1, withinChapter: 1};
}
