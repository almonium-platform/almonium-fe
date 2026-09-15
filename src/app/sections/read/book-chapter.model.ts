import {expectArray, expectEnum, expectNumber, expectRecord, expectString, expectUuid} from '../../shared/runtime-validation';

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
      cefrEstimate: row['cefrEstimate'] == null ? null : expectEnum(row['cefrEstimate'], ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], `${path}.cefrEstimate`),
      descriptions: expectArray(row['descriptions'], `${path}.descriptions`).map(item => expectString(item, `${path}.descriptions`)),
    };
  });
}
