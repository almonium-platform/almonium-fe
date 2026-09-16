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

/**
 * The excerpt shown under a word: the sentence that holds the observed form, cut at sentence
 * boundaries rather than at a character count, with the form's place marked for a highlight.
 */
export function wordExcerpt(word: ChapterWord): {text: string; hit: boolean}[] {
  const context = word.context.replace(/\s+/g, ' ').trim();
  const needle = word.surface.trim() || word.lemma.trim();
  const index = context.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return [{text: context, hit: false}];
  const boundary = /[.!?…]["”»']?\s/g;
  let start = 0;
  let end = context.length;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(context)) !== null) {
    const cut = match.index + match[0].length;
    if (cut <= index) start = cut;
    else if (match.index >= index + needle.length) {
      end = match.index + match[0].trimEnd().length;
      break;
    }
  }
  return [
    {text: context.slice(start, index), hit: false},
    {text: context.slice(index, index + needle.length), hit: true},
    {text: context.slice(index + needle.length, end), hit: false},
  ].filter(part => part.text.length > 0);
}

export function vocabularyDiscoverParams(word: ChapterWord, vocabulary: ChapterVocabulary, book: string, bookTitle: string, chapterTitle: string) {
  return {text: word.lemma, context: word.context, language: vocabulary.language.toUpperCase(), book, bookTitle,
    chapter: vocabulary.chapterSequence, chapterTitle, block: word.blockId};
}
