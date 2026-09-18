import {LanguageCode} from '../../../models/language.enum';
import {expectArray, expectBoolean, expectDate, expectEnum, expectNumber, expectRecord, expectString} from '../../../shared/runtime-validation';

/**
 * A book read to the end (design K): what the certificate says and nothing more. The owner and a stranger get the
 * same record; the only line a stranger never sees is a page that is off, which is a 404 rather than a field.
 */
export interface BookCertificate {
  username: string;
  editionSlug: string;
  title: string;
  author: string;
  language: LanguageCode;
  /** The twelve rarest words the reader met, rarest first, as they were met. */
  words: string[];
  wordsRead: number;
  wordsSaved: number;
  finishedAt: Date;
  publicPage: boolean;
}

export function parseBookCertificate(value: unknown): BookCertificate {
  const data = expectRecord(value, 'certificate');
  return {
    username: expectString(data['username'], 'certificate.username'),
    editionSlug: expectString(data['editionSlug'], 'certificate.editionSlug'),
    title: expectString(data['title'], 'certificate.title'),
    author: expectString(data['author'], 'certificate.author'),
    language: expectEnum(data['language'], Object.values(LanguageCode), 'certificate.language'),
    words: expectArray(data['words'], 'certificate.words').map(word => expectString(word, 'certificate.words')),
    wordsRead: expectNumber(data['wordsRead'], 'certificate.wordsRead'),
    wordsSaved: expectNumber(data['wordsSaved'], 'certificate.wordsSaved'),
    finishedAt: expectDate(data['finishedAt'], 'certificate.finishedAt'),
    publicPage: expectBoolean(data['publicPage'], 'certificate.publicPage'),
  };
}

/** The public page's path, the same one the reader copies and a stranger arrives at. */
export function certificatePath(certificate: Pick<BookCertificate, 'username' | 'editionSlug'>): string {
  return `/read/@${encodeURIComponent(certificate.username)}/${encodeURIComponent(certificate.editionSlug)}`;
}
