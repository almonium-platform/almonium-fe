import {LANGUAGE_COLOURS} from '../../shared/language-colours';

/**
 * A stable colour for a language code where no account colour exists - a signed-out page has no navbar to carry the
 * edge rail, so the badge is the one place the language's hue appears. The same code always hashes to the same hue.
 */
export function languageBadgeFill(code: string): string {
  let hash = 0;
  for (const char of code) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return LANGUAGE_COLOURS[hash % LANGUAGE_COLOURS.length].hex;
}

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

/** "second", "third" - how a new language would number among the viewer's. */
export function ordinalInWords(position: number): string {
  return ORDINALS[position - 1] ?? `${position}th`;
}
