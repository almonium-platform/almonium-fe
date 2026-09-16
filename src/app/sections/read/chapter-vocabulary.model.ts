import {expectArray, expectEnum, expectNumber, expectRecord, expectString, expectUuid} from '../../shared/runtime-validation';

export interface ChapterWord {
  lemma: string;
  surface: string;
  context: string;
  blockId: string;
}

export interface ChapterVocabulary {
  chapterId: string;
  chapterSequence: number;
  language: string;
  status: 'ready' | 'pending' | 'stale' | 'unavailable';
  words: ChapterWord[];
}

export function parseChapterVocabulary(value: unknown): ChapterVocabulary {
  const data = expectRecord(value, 'vocabulary');
  const status = expectEnum(data['status'], ['ready', 'pending', 'stale', 'unavailable'] as const, 'vocabulary.status');
  return {
    chapterId: expectUuid(data['chapterId'], 'vocabulary.chapterId'),
    chapterSequence: expectNumber(data['chapterSequence'], 'vocabulary.chapterSequence'),
    language: expectString(data['language'], 'vocabulary.language'),
    status,
    words: status !== 'ready' ? [] : expectArray(data['words'], 'vocabulary.words').map(value => {
      const word = expectRecord(value, 'vocabulary.word');
      return {
        lemma: expectString(word['lemma'], 'word.lemma'),
        surface: expectString(word['surface'], 'word.surface'),
        context: expectString(word['context'], 'word.context'),
        blockId: expectString(word['blockId'], 'word.blockId'),
      };
    }),
  };
}

export function vocabularyDiscoverParams(word: ChapterWord, vocabulary: ChapterVocabulary, book: string, bookTitle: string, chapterTitle: string) {
  return {text: word.lemma, context: word.context, language: vocabulary.language.toUpperCase(), book, bookTitle,
    chapter: vocabulary.chapterSequence, chapterTitle, block: word.blockId};
}
