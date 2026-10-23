import {LanguageCode} from '../../models/language.enum';

/**
 * The letters a keyboard may lack, offered after their base letter (design 4c). Each list is ordered by how
 * often the variant occurs in that language, so the first ↑ lands on the likeliest one (French e: é è ê ë).
 */
const RINGS: Partial<Record<LanguageCode, Record<string, string[]>>> = {
  [LanguageCode.DE]: {a: ['ä'], o: ['ö'], u: ['ü'], s: ['ß']},
  [LanguageCode.FR]: {e: ['é', 'è', 'ê', 'ë'], a: ['à', 'â', 'æ'], c: ['ç'], i: ['î', 'ï'], o: ['ô', 'œ'], u: ['ù', 'û', 'ü'], y: ['ÿ']},
  [LanguageCode.ES]: {n: ['ñ'], a: ['á'], e: ['é'], i: ['í'], o: ['ó'], u: ['ú', 'ü'], '?': ['¿'], '!': ['¡']},
  [LanguageCode.IT]: {e: ['è', 'é'], a: ['à'], i: ['ì'], o: ['ò'], u: ['ù']},
  [LanguageCode.PL]: {a: ['ą'], c: ['ć'], e: ['ę'], l: ['ł'], n: ['ń'], o: ['ó'], s: ['ś'], z: ['ż', 'ź']},
  [LanguageCode.PT]: {a: ['ã', 'á', 'â', 'à'], c: ['ç'], e: ['é', 'ê'], i: ['í'], o: ['õ', 'ó', 'ô'], u: ['ú']},
};

/** A handful of each language's letters, for the guest language menu: the menu also says what the field offers. */
export const SIGNATURE_LETTERS: Partial<Record<LanguageCode, string>> = {
  [LanguageCode.DE]: 'ä ö ü ß',
  [LanguageCode.FR]: 'é è ç œ',
  [LanguageCode.ES]: 'ñ á ¿ ¡',
  [LanguageCode.IT]: 'à è ò',
  [LanguageCode.PL]: 'ą ę ł ż',
  [LanguageCode.PT]: 'ã ç õ',
};

/**
 * The ring for a just-typed character: the plain letter first, then its variants, so stepping past the last
 * variant returns to the plain letter. Capitals follow (U gives Ü); a variant with no single capital (ß) drops out.
 * Null when the language has nothing to offer for the character.
 */
export function ringFor(language: LanguageCode, character: string): string[] | null {
  const variants = RINGS[language]?.[character.toLocaleLowerCase()];
  if (!variants) return null;
  const lower = character === character.toLocaleLowerCase();
  const offered = lower ? variants : variants.map(variant => variant.toLocaleUpperCase()).filter(variant => variant.length === 1);
  return offered.length ? [character, ...offered] : null;
}
