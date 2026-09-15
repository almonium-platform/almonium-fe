import {LanguageCode} from '../../models/language.enum';
import {
  expectArray,
  expectBoolean,
  expectEnum,
  expectNullableString,
  expectNumber,
  expectRecord,
  expectString,
  expectUuid,
} from '../../shared/runtime-validation';

export const sharedLinkStatuses = ['ACTIVE', 'REVOKED', 'DELETED'] as const;
export type SharedLinkStatus = typeof sharedLinkStatuses[number];

export interface SharedExample {
  example: string;
  translation: string | null;
}

/** A word as a stranger sees it: entry and senses, none of the owner's progress. */
export interface SharedWord {
  id: string;
  entry: string;
  partOfSpeech: string | null;
  selectedSense: string | null;
  translations: string[];
  examples: SharedExample[];
  sourceContext: string | null;
}

export interface Sharer {
  username: string;
  avatarUrl: string | null;
  premium: boolean;
}

export interface SharedCardView {
  language: LanguageCode;
  word: SharedWord;
  sharer: Sharer;
}

export interface SharedDeckView {
  status: SharedLinkStatus;
  shareId: string | null;
  title: string | null;
  language: LanguageCode | null;
  words: SharedWord[];
  sharer: Sharer | null;
}

/** What a signed-in viewer already holds of the shared object. */
export interface SharedLinkViewerStatus {
  owner: boolean;
  hasLearner: boolean;
  heldWordIds: string[];
  dueAmongHeld: number;
}

export interface AddedWordsResult {
  added: number;
  alreadyHeld: number;
  firstDueAt: Date | null;
}

export interface Deck {
  id: string;
  title: string;
  language: LanguageCode;
  shareId: string;
  shareEnabled: boolean;
  wordIds: string[];
}

export function parseSharedWord(value: unknown, path = 'word'): SharedWord {
  const word = expectRecord(value, path);
  return {
    id: expectUuid(word['id'], `${path}.id`),
    entry: expectString(word['entry'], `${path}.entry`),
    partOfSpeech: expectNullableString(word['partOfSpeech'], `${path}.partOfSpeech`),
    selectedSense: expectNullableString(word['selectedSense'], `${path}.selectedSense`),
    translations: expectArray(word['translations'], `${path}.translations`)
      .map((translation, index) => expectString(translation, `${path}.translations[${index}]`)),
    examples: expectArray(word['examples'], `${path}.examples`).map((example, index) => {
      const record = expectRecord(example, `${path}.examples[${index}]`);
      return {
        example: expectString(record['example'], `${path}.examples[${index}].example`),
        translation: expectNullableString(record['translation'], `${path}.examples[${index}].translation`),
      };
    }),
    sourceContext: expectNullableString(word['sourceContext'], `${path}.sourceContext`),
  };
}

function parseSharer(value: unknown, path: string): Sharer {
  const sharer = expectRecord(value, path);
  return {
    username: expectString(sharer['username'], `${path}.username`),
    avatarUrl: expectNullableString(sharer['avatarUrl'], `${path}.avatarUrl`),
    premium: expectBoolean(sharer['premium'], `${path}.premium`),
  };
}

export function parseSharedCardView(value: unknown): SharedCardView {
  const view = expectRecord(value, 'sharedCard');
  return {
    language: expectEnum(view['language'], Object.values(LanguageCode), 'sharedCard.language'),
    word: parseSharedWord(view['word'], 'sharedCard.word'),
    sharer: parseSharer(view['sharer'], 'sharedCard.sharer'),
  };
}

export function parseSharedDeckView(value: unknown): SharedDeckView {
  const view = expectRecord(value, 'sharedDeck');
  const status = expectEnum(view['status'], sharedLinkStatuses, 'sharedDeck.status');
  if (status !== 'ACTIVE') {
    return {status, shareId: null, title: null, language: null, words: [], sharer: null};
  }
  return {
    status,
    shareId: expectString(view['shareId'], 'sharedDeck.shareId'),
    title: expectString(view['title'], 'sharedDeck.title'),
    language: expectEnum(view['language'], Object.values(LanguageCode), 'sharedDeck.language'),
    words: expectArray(view['words'], 'sharedDeck.words')
      .map((word, index) => parseSharedWord(word, `sharedDeck.words[${index}]`)),
    sharer: parseSharer(view['sharer'], 'sharedDeck.sharer'),
  };
}

export function parseViewerStatus(value: unknown): SharedLinkViewerStatus {
  const status = expectRecord(value, 'viewer');
  return {
    owner: expectBoolean(status['owner'], 'viewer.owner'),
    hasLearner: expectBoolean(status['hasLearner'], 'viewer.hasLearner'),
    heldWordIds: expectArray(status['heldWordIds'], 'viewer.heldWordIds')
      .map((id, index) => expectUuid(id, `viewer.heldWordIds[${index}]`)),
    dueAmongHeld: expectNumber(status['dueAmongHeld'], 'viewer.dueAmongHeld'),
  };
}

export function parseAddedWordsResult(value: unknown): AddedWordsResult {
  const result = expectRecord(value, 'added');
  const firstDueAt = result['firstDueAt'];
  return {
    added: expectNumber(result['added'], 'added.added'),
    alreadyHeld: expectNumber(result['alreadyHeld'], 'added.alreadyHeld'),
    firstDueAt: firstDueAt == null ? null : new Date(expectString(firstDueAt, 'added.firstDueAt')),
  };
}

export function parseDeck(value: unknown): Deck {
  const deck = expectRecord(value, 'deck');
  return {
    id: expectUuid(deck['id'], 'deck.id'),
    title: expectString(deck['title'], 'deck.title'),
    language: expectEnum(deck['language'], Object.values(LanguageCode), 'deck.language'),
    shareId: expectString(deck['shareId'], 'deck.shareId'),
    shareEnabled: expectBoolean(deck['shareEnabled'], 'deck.shareEnabled'),
    wordIds: expectArray(deck['wordIds'], 'deck.wordIds').map((id, index) => expectUuid(id, `deck.wordIds[${index}]`)),
  };
}
