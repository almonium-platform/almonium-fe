import {LanguageCode} from '../../models/language.enum';

/**
 * What the one Discover field does with its text (design 4e). Length and shape decide what ↵ does, and the
 * button says it before you press.
 */
export type DiscoverTier = 'empty' | 'word' | 'sentence' | 'passage' | 'over';

/** Members break down up to this many characters; past it the text goes to the reader instead. */
export const MEMBER_CAP = 2000;
/** Guests stop here: lookups are served from the database, breakdowns are model calls. */
export const GUEST_CAP = 400;
const SENTENCE_LIMIT = 400;
const WORD_LIMIT = 60;

/** The languages a guest can pick in the field, in menu order. */
export const GUEST_LANGUAGES: readonly LanguageCode[] = [
  LanguageCode.DE, LanguageCode.FR, LanguageCode.ES, LanguageCode.IT, LanguageCode.PL, LanguageCode.PT, LanguageCode.EN,
];

/**
 * A word or expression is up to three words and 60 characters with no closing punctuation. Phrases the
 * dictionary holds up to six words belong here too, once the lexicon can be asked whether it holds one.
 */
export function tierOf(text: string, cap: number): DiscoverTier {
  const trimmed = text.trim();
  if (!trimmed) return 'empty';
  if (trimmed.length > cap) return 'over';
  if (trimmed.split(/\s+/).length <= 3 && trimmed.length <= WORD_LIMIT && !/[.!?…]$/.test(trimmed)) return 'word';
  return trimmed.length <= SENTENCE_LIMIT ? 'sentence' : 'passage';
}

/** Type steps down as the text grows: one line, a sentence, a passage. */
export function sizeOf(text: string): 'line' | 'sentence' | 'passage' {
  if (text.length <= 34) return 'line';
  return text.length <= SENTENCE_LIMIT ? 'sentence' : 'passage';
}

const GUEST_LANGUAGE_KEY = 'discover.guestLanguage';
const RECENTS_KEY = 'discover.recents';
const RECENTS_LIMIT = 8;

/**
 * What a guest whose browser speaks a language most often learns. A placeholder until the backend can say
 * it from real sign-ups; anything unlisted learns English.
 */
const LEARNED_BY_BROWSER_LANGUAGE: Record<string, LanguageCode> = {
  en: LanguageCode.ES,
};

/**
 * A guest always has a language, because the letters depend on it. The guess, in order: the link they came
 * on, the last language picked on this device, then what people with their browser language learn.
 */
export function guessGuestLanguage(fromLink: LanguageCode | null, browserLanguages: readonly string[]): LanguageCode {
  if (fromLink && GUEST_LANGUAGES.includes(fromLink)) return fromLink;
  const stored = read<LanguageCode>(GUEST_LANGUAGE_KEY);
  if (stored && GUEST_LANGUAGES.includes(stored)) return stored;
  const browser = browserLanguages[0]?.slice(0, 2).toLowerCase() ?? '';
  return LEARNED_BY_BROWSER_LANGUAGE[browser] ?? LanguageCode.EN;
}

export function rememberGuestLanguage(language: LanguageCode): void {
  write(GUEST_LANGUAGE_KEY, language);
}

/** Recent lookups not yet kept, newest first, on this device. */
export function readRecents(language: LanguageCode): string[] {
  const recents = read<string[]>(`${RECENTS_KEY}.${language}`);
  return Array.isArray(recents) ? recents.filter(value => typeof value === 'string') : [];
}

export function addRecent(language: LanguageCode, entry: string): string[] {
  const recents = [entry, ...readRecents(language).filter(value => value.toLocaleLowerCase() !== entry.toLocaleLowerCase())]
    .slice(0, RECENTS_LIMIT);
  write(`${RECENTS_KEY}.${language}`, recents);
  return recents;
}

export function removeRecent(language: LanguageCode, entry: string): string[] {
  const recents = readRecents(language).filter(value => value.toLocaleLowerCase() !== entry.toLocaleLowerCase());
  write(`${RECENTS_KEY}.${language}`, recents);
  return recents;
}

export function forgetRecents(language: LanguageCode): string[] {
  write(`${RECENTS_KEY}.${language}`, []);
  return [];
}

function read<T>(key: string): T | null {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? null : JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private windows and blocked storage: the field still works, it only forgets.
  }
}
