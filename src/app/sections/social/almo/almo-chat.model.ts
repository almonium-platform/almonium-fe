import {expectArray, expectNullableString, expectRecord, expectString} from '../../../shared/runtime-validation';

/** A chip above the composer. `word` is the queue word inside it, if any, so the chip can mark provenance. */
export interface AlmoOpener {
  text: string;
  word: string | null;
}

/** One Almo channel: a conversation is a language, so the server hands one of these per target language. */
export interface AlmoChat {
  cid: string;
  language: string;
  name: string;
  placeholder: string;
  openers: AlmoOpener[];
}

/** What became of a request for a reply. The reply itself arrives through Stream. */
export interface AlmoReply {
  replyMessageId: string | null;
  ceilingReached: boolean;
}

export function parseAlmoChats(value: unknown, path = 'almo chats'): AlmoChat[] {
  return expectArray(value, path).map((item, index) => {
    const chat = expectRecord(item, `${path}[${index}]`);
    return {
      cid: expectString(chat['cid'], `${path}[${index}].cid`),
      language: expectString(chat['language'], `${path}[${index}].language`),
      name: expectString(chat['name'], `${path}[${index}].name`),
      placeholder: expectString(chat['placeholder'], `${path}[${index}].placeholder`),
      openers: expectArray(chat['openers'], `${path}[${index}].openers`).map((opener, i) => {
        const record = expectRecord(opener, `${path}[${index}].openers[${i}]`);
        return {
          text: expectString(record['text'], `${path}[${index}].openers[${i}].text`),
          word: expectNullableString(record['word'] ?? null, `${path}[${index}].openers[${i}].word`),
        };
      }),
    };
  });
}

export function parseAlmoReply(value: unknown, path = 'almo reply'): AlmoReply {
  const reply = expectRecord(value, path);
  return {
    replyMessageId: expectNullableString(reply['replyMessageId'] ?? null, `${path}.replyMessageId`),
    ceilingReached: reply['ceilingReached'] === true,
  };
}

/**
 * The fields the server writes on a message in Almo's channel. They are custom Stream data, so they
 * arrive untyped; a message without them is an ordinary message and renders as one.
 */
export interface AlmoMessageMarks {
  /** Queue words the text uses, in the exact form they take in it. Dotted underline. */
  words: string[];
  /** Both members of a confusion pair the reply contrasts, as written. Plum, medium weight. */
  contrast: string[];
  /** The same line in the learner's language, swapped in while the bubble is held. */
  translation: string | null;
}

export function almoMarksOf(message: unknown): AlmoMessageMarks | null {
  if (!message || typeof message !== 'object') return null;
  const record = message as Record<string, unknown>;
  const words = stringList(record['almoWords']);
  const contrast = stringList(record['almoContrast']);
  const translation = typeof record['almoTranslation'] === 'string' && record['almoTranslation'].trim()
    ? record['almoTranslation']
    : null;
  if (!words.length && !contrast.length && !translation) return null;
  return {words, contrast, translation};
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && !!item.trim()) : [];
}
