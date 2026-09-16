import {expectArray, expectEnum, expectNumber, expectRecord, expectString, expectUuid} from '../../shared/runtime-validation';

export const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export interface BookChapter {
  id: string;
  sequence: number;
  title: string;
  analysisStatus: string;
  cefrEstimate: string | null;
  descriptions: string[];
}

export function parseBookChapters(value: unknown): BookChapter[] {
  return expectArray(value, 'chapters').map((value, index) => {
    const path = `chapters[${index}]`;
    const row = expectRecord(value, path);
    const status = expectString(row['analysisStatus'], `${path}.analysisStatus`);
    return {
      id: expectUuid(row['id'], `${path}.id`),
      sequence: expectNumber(row['sequence'], `${path}.sequence`),
      title: expectString(row['title'], `${path}.title`),
      analysisStatus: status,
      cefrEstimate: row['cefrEstimate'] == null ? null : expectEnum(row['cefrEstimate'], CEFR_ORDER, `${path}.cefrEstimate`),
      descriptions: expectArray(row['descriptions'], `${path}.descriptions`).map(item => expectString(item, `${path}.descriptions`)),
    };
  });
}

/**
 * The source's "CHAPTER V." becomes "Chapter V" for display only: the trailing full stop goes, shouting
 * caps become title case, and roman numerals keep their capitals. Mixed-case titles are left alone.
 */
export function displayChapterTitle(raw: string): string {
  const title = raw.replace(/\s+/g, ' ').trim().replace(/\.$/, '').trim();
  if (!/\p{L}/u.test(title) || title !== title.toLocaleUpperCase()) return title;
  return title.split(' ').map(word => {
    const core = word.replace(/[^\p{L}]/gu, '');
    if (/^[IVXLCDM]+$/.test(core)) return word;
    return word.charAt(0) + word.slice(1).toLocaleLowerCase();
  }).join(' ');
}

/** "B1–C1" over the chapters that have an estimate, or null when none has one yet. */
export function chapterLevelRange(chapters: BookChapter[]): string | null {
  const levels = chapters.map(chapter => chapter.cefrEstimate).filter((level): level is string => level !== null);
  if (levels.length === 0) return null;
  const ranks = levels.map(level => CEFR_ORDER.indexOf(level as typeof CEFR_ORDER[number]));
  const low = CEFR_ORDER[Math.min(...ranks)];
  const high = CEFR_ORDER[Math.max(...ranks)];
  return low === high ? low : `${low}–${high}`;
}
