import {DiscoverLookup, DiscoverPronunciation, DiscoverSense} from './discover.service';
import {VarietyNamer, lexemeFacts, partOfSpeechLabel, senseFacts} from './entry-shape';
import {distance} from './pronunciation-table';

/**
 * Two entries side by side ("big vs large", design Compare 1a), from what each sheet already holds: a row says only
 * what the lexicon says of each word. Words are compared one meaning against one meaning, since "bank" the river's
 * edge and "bank" the lender have little in common but their spelling. Rows are shown only where the two differ;
 * what they have in common folds into one line.
 */

/** The rows built from the lexicon's lists, in the sheet's own order. */
export type ComparisonRowKind = 'use' | 'grammar' | 'forms' | 'spelled' | 'pattern' | 'often' | 'opposite';

export interface ComparedItem {
  text: string;
  /** What the item is, where it needs saying: "past participle" beside a form, "British" beside a spelling. */
  note: string;
}

/** A row the two words differ in; a side with nothing is an empty cell, which the table prints as a dash. */
export interface ComparisonRow {
  kind: ComparisonRowKind;
  cells: [ComparedItem[], ComparedItem[]];
}

export interface Comparison {
  rows: ComparisonRow[];
  /** What both words are commonly said with, without the word itself: "house" for big house and large house. */
  either: string[];
  /** What holds for both, as the one line under the rows: "adjective", "before a noun or after be". */
  same: string[];
}

/** One word of the pair with the meaning it is compared by. */
export interface ComparedSide {
  lookup: DiscoverLookup;
  sense: DiscoverSense;
  varietyName: VarietyNamer;
}

/** A run of a headword, and whether it is where the two spellings part. */
export interface SpellingPart {
  text: string;
  differs: boolean;
}

const ROW_ORDER: ComparisonRowKind[] = ['use', 'grammar', 'forms', 'spelled', 'pattern', 'often', 'opposite'];

function facts(side: ComparedSide, locale: string): Record<ComparisonRowKind, ComparedItem[]> {
  const {lookup, sense, varietyName} = side;
  const lexeme = lookup.lexemes.find(each => each.index === sense.lexeme);
  const word = lexeme ? lexemeFacts(lexeme, lookup.language, varietyName) : null;
  const meaning = senseFacts(sense, lookup.language, varietyName, locale);
  const plain = (texts: (string | null | undefined)[]): ComparedItem[] =>
    [...new Set(texts.filter((text): text is string => !!text))].map(text => ({text, note: ''}));
  // Forms are set against each other only for a word the lexicon marks irregular: the sheet lists a regular word's
  // forms too (affects, affected; principles), and two such lists say nothing of how the words differ.
  const regular = lexeme?.grammar['irregular'] !== true;
  return {
    use: plain(meaning.marks),
    grammar: plain([...(word?.grammar ?? []), ...meaning.grammar, word?.note, meaning.note]),
    forms: regular ? [] : (word?.forms ?? [])
      .filter(form => !form.senses.length || form.senses.includes(sense.index))
      .map(form => ({text: form.reading ?? form.form, note: form.label})),
    spelled: (word?.spellings ?? []).map(spelling => ({text: spelling.text, note: spelling.where})),
    pattern: plain(sense.frames),
    often: plain(sense.collocations),
    opposite: plain(sense.antonyms),
  };
}

function key(item: ComparedItem): string {
  return `${item.text.toLocaleLowerCase()}\n${item.note.toLocaleLowerCase()}`;
}

function wordsOf(text: string | null): string[] {
  return (text ?? '').toLocaleLowerCase().match(/[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu) ?? [];
}

/**
 * A collocation without the word it is a collocation of: "house" for "big house", "a matter of" for "a matter of
 * principle". Null when the word is not in it as written or inflected, so nothing can be said of what is left.
 */
function company(collocation: string, headword: string): string | null {
  const stem = headword.toLocaleLowerCase();
  const words = wordsOf(collocation);
  const at = words.includes(stem) ? words.indexOf(stem) : words.findIndex(word => word.startsWith(stem));
  if (at < 0 || words.length < 2) return null;
  // A leading article is not company: "a large house" keeps the company "big house" does.
  return words.filter((_, index) => index !== at).join(' ').replace(/^(?:a|an|the) (?=.)/, '');
}

/** The rows the two words differ in, what both are said with, and what holds for both. */
export function compare(first: ComparedSide, second: ComparedSide, locale: string): Comparison {
  const [a, b] = [facts(first, locale), facts(second, locale)];
  const headwords = [first, second].map(side => side.sense.headword || side.lookup.entry);

  // A collocation both words have with the same company ("big house", "large house") is said once, of either.
  const kept = [a.often, b.often].map((items, at) => items.map(item => ({item, with: company(item.text, headwords[at])})));
  const shared = kept[0].map(each => each.with).filter((each): each is string => !!each && kept[1].some(other => other.with === each));
  const either = [...new Set(shared)];
  a.often = kept[0].filter(each => !each.with || !either.includes(each.with)).map(each => each.item);
  b.often = kept[1].filter(each => !each.with || !either.includes(each.with)).map(each => each.item);

  const rows: ComparisonRow[] = [];
  const same: string[] = [];
  const [firstPart, secondPart] = [first.sense.partOfSpeech, second.sense.partOfSpeech];
  if (firstPart && firstPart === secondPart) same.push(partOfSpeechLabel(firstPart));
  for (const kind of ROW_ORDER) {
    const [left, right] = [new Set(a[kind].map(key)), new Set(b[kind].map(key))];
    if (!left.size && !right.size) continue;
    const alike = left.size === right.size && [...left].every(each => right.has(each));
    // Collocations in common are the "either word" row; the rest fold like any other fact.
    if (alike) same.push(...a[kind].map(item => item.note ? `${item.text} (${item.note})` : item.text));
    else rows.push({kind, cells: [a[kind], b[kind]]});
  }
  return {rows, either, same};
}

/** Every way a sheet names its word, in lower case: what was looked up, its lemmas, its senses' headwords. */
function names(lookup: DiscoverLookup): Set<string> {
  return new Set([lookup.entry, ...lookup.lexemes.map(lexeme => lexeme.lemma), ...lookup.senses.map(sense => sense.headword)]
    .map(name => name.toLocaleLowerCase()));
}

function sharedCount(a: string[], b: string[]): number {
  const other = new Set(b.map(each => each.toLocaleLowerCase()));
  return a.filter(each => other.has(each.toLocaleLowerCase())).length;
}

/**
 * The pair that most plainly belongs together when the lexicon does not say which: two senses are near when they
 * share a translation, when one is defined with the other word ("big: large in size") or names it as its opposite,
 * when they share an opposite and when they are the same part of speech. Every step down either list costs a
 * little, so a shared part of speech alone does not pull a rare sense up.
 */
export function bestPair(first: DiscoverLookup, firstSenses: DiscoverSense[], second: DiscoverLookup, secondSenses: DiscoverSense[]): [number, number] {
  const [firstNames, secondNames] = [names(first), names(second)];
  const mentions = (sense: DiscoverSense, others: Set<string>) => wordsOf(sense.definition).some(word => others.has(word))
    || sense.antonyms.some(antonym => others.has(antonym.toLocaleLowerCase()));
  let best: [number, number] = [0, 0];
  let bestScore = -Infinity;
  firstSenses.forEach((a, i) => secondSenses.forEach((b, j) => {
    const score = 4 * sharedCount(a.translations, b.translations)
      + (mentions(a, secondNames) ? 3 : 0) + (mentions(b, firstNames) ? 3 : 0)
      + 2 * sharedCount(a.antonyms, b.antonyms)
      + (a.partOfSpeech && a.partOfSpeech === b.partOfSpeech ? 1 : 0)
      - (i + j) * 0.75;
    if (score > bestScore) {
      bestScore = score;
      best = [i, j];
    }
  }));
  return best;
}

/**
 * The meanings the two words are first compared by, as positions in the given lists. Where the lexicon says one
 * word is mixed up with the other, it is that relation's own sense against the other word in the part of speech the
 * relation names (affect the verb against effect the noun); otherwise the pair `bestPair` finds.
 */
export function startingPair(first: DiscoverLookup, firstSenses: DiscoverSense[], second: DiscoverLookup, secondSenses: DiscoverSense[]): [number, number] {
  const orders: [DiscoverLookup, DiscoverSense[], DiscoverLookup, DiscoverSense[], boolean][] =
    [[first, firstSenses, second, secondSenses, false], [second, secondSenses, first, firstSenses, true]];
  for (const [from, fromSenses, to, toSenses, flipped] of orders) {
    const toNames = names(to);
    for (const lexeme of from.lexemes) {
      for (const relation of lexeme.relations) {
        if (relation.type !== 'confusable' || !toNames.has(relation.lemma.toLocaleLowerCase())) continue;
        const own = fromSenses.findIndex(sense => relation.senses.length ? relation.senses.includes(sense.index) : sense.lexeme === lexeme.index);
        const other = toSenses.findIndex(sense => !relation.partOfSpeech || sense.partOfSpeech?.toUpperCase() === relation.partOfSpeech.toUpperCase());
        if (own >= 0 && other >= 0) return flipped ? [other, own] : [own, other];
      }
    }
  }
  return bestPair(first, firstSenses, second, secondSenses);
}

/**
 * How a word is said in the meaning compared: the reading that meaning takes, in the wanted variety when the entry
 * has it and in the entry's first otherwise. Null when the entry transcribes nothing.
 */
export function soundOf(lookup: DiscoverLookup, sense: DiscoverSense, variety: string | null): DiscoverPronunciation | null {
  const taking = lookup.pronunciations.filter(pronunciation => pronunciation.senses.includes(sense.index));
  const readings = taking.length ? taking : lookup.pronunciations;
  const wanted = variety?.toLowerCase();
  return readings.find(pronunciation => pronunciation.variety.toLowerCase() === wanted) ?? readings[0] ?? null;
}

/** Two spellings, or two transcriptions, are close when few of their letters differ for their length. */
function close(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const longer = Math.max(Array.from(a).length, Array.from(b).length);
  return distance(a.toLocaleLowerCase(), b.toLocaleLowerCase()) <= Math.min(3, Math.floor(longer / 3));
}

/**
 * Whether the two words have nothing to be compared by (design Compare 1d): the lexicon relates them nowhere, no
 * meaning of one is the part of speech of a meaning of the other, and they are neither written nor said nearly alike.
 */
export function nothingToCompare(first: DiscoverLookup, second: DiscoverLookup): boolean {
  const lookups = [first, second];
  const named = lookups.map(names);
  const linked = lookups.some((lookup, at) =>
    lookup.lexemes.some(lexeme => lexeme.relations.some(relation => named[1 - at].has(relation.lemma.toLocaleLowerCase())))
    || lookup.senses.some(sense => sense.antonyms.some(antonym => named[1 - at].has(antonym.toLocaleLowerCase())))
    || lookup.homophones.some(homophone => named[1 - at].has(homophone.word.toLocaleLowerCase())));
  if (linked) return false;
  const parts = new Set(first.senses.map(sense => sense.partOfSpeech?.toUpperCase()).filter(Boolean));
  if (second.senses.some(sense => parts.has(sense.partOfSpeech?.toUpperCase()))) return false;
  return !close(first.entry, second.entry) && !close(first.pronunciations[0]?.ipa ?? null, second.pronunciations[0]?.ipa ?? null);
}

/**
 * The two headwords cut where their spellings part, when that is three letters or fewer of each (principal,
 * principle): what they share before and after, and the letters between. Null when they differ by more, or share
 * nothing to stand the difference against.
 */
export function spellingParts(first: string, second: string): [SpellingPart[], SpellingPart[]] | null {
  const [a, b] = [Array.from(first), Array.from(second)];
  const fold = (letter: string) => letter.toLocaleLowerCase();
  let head = 0;
  while (head < a.length && head < b.length && fold(a[head]) === fold(b[head])) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && fold(a[a.length - 1 - tail]) === fold(b[b.length - 1 - tail])) tail++;
  const [middleA, middleB] = [a.slice(head, a.length - tail), b.slice(head, b.length - tail)];
  if (!(middleA.length || middleB.length) || middleA.length > 3 || middleB.length > 3 || head + tail < 2) return null;
  const parts = (letters: string[], middle: string[]): SpellingPart[] => [
    {text: letters.slice(0, head).join(''), differs: false},
    {text: middle.join(''), differs: true},
    {text: letters.slice(letters.length - tail).join(''), differs: false},
  ].filter(part => part.text);
  return [parts(a, middleA), parts(b, middleB)];
}

/** A frame cut into what is the word, what is an open place (sth, sb) and the rest: "big on sth". */
export function frameParts(frame: string, headword: string): {text: string; kind: 'word' | 'slot' | 'plain'}[] {
  const stem = headword.toLocaleLowerCase();
  return frame.split(/(\s+)/).map(text => {
    const bare = text.toLocaleLowerCase().replace(/[^\p{L}\p{M}'’]/gu, '');
    if (/^(sth|sb|sb's|sb’s|swh|sw|adj|adv|inf|to-inf|doing|etw|jdn|jdm|jds|qc|qn|qqch|qqn|algo|alguien)$/.test(bare)) return {text, kind: 'slot' as const};
    return {text, kind: bare && (bare === stem || bare.startsWith(stem)) ? 'word' as const : 'plain' as const};
  });
}

/** A written summary cut around the first mention of each headword, which the sheet sets apart in it. */
export function summaryParts(summary: string, headwords: string[]): {text: string; word: boolean}[] {
  const escaped = headwords.filter(Boolean).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!escaped.length) return [{text: summary, word: false}];
  const pattern = new RegExp(`(?<![\\p{L}\\p{M}])(${escaped.join('|')})(?![\\p{L}\\p{M}])`, 'giu');
  const parts: {text: string; word: boolean}[] = [];
  let from = 0;
  const seen = new Set<string>();
  for (const match of summary.matchAll(pattern)) {
    const word = match[0].toLocaleLowerCase();
    if (seen.has(word)) continue;
    seen.add(word);
    if (match.index > from) parts.push({text: summary.slice(from, match.index), word: false});
    parts.push({text: match[0], word: true});
    from = match.index + match[0].length;
  }
  if (from < summary.length) parts.push({text: summary.slice(from), word: false});
  return parts;
}
