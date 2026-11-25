import {DiscoverLookup, DiscoverPronunciation, DiscoverSense} from './discover.service';
import {VarietyNamer, lexemeFacts, relationLabel, senseFacts} from './entry-shape';

/**
 * Two entries side by side ("affect vs effect"), from what each sheet already holds: nothing here is written for the
 * pair, so a row says only what the lexicon says of each word. Words are compared one meaning against one meaning,
 * since "bank" the river's edge and "bank" the lender have little in common but their spelling.
 */

/** The rows built from the lexicon's lists, in the order the table prints them. */
export type ComparisonRowKind = 'level' | 'use' | 'grammar' | 'pattern' | 'often' | 'opposite' | 'forms' | 'spelled';

export interface ComparedItem {
  text: string;
  /** What the item is, where it needs saying: "past participle" beside a form, "British" beside a spelling. */
  note: string;
  /** The other word has it too. */
  shared: boolean;
}

export interface ComparisonRow {
  kind: ComparisonRowKind;
  cells: [ComparedItem[], ComparedItem[]];
  /** Both words say exactly the same here. */
  same: boolean;
}

/** One word of the pair with the meaning it is compared by. */
export interface ComparedSide {
  lookup: DiscoverLookup;
  sense: DiscoverSense;
  varietyName: VarietyNamer;
}

const ROW_ORDER: ComparisonRowKind[] = ['level', 'use', 'grammar', 'pattern', 'often', 'opposite', 'forms', 'spelled'];

type Fact = Pick<ComparedItem, 'text' | 'note'>;

function facts(side: ComparedSide, locale: string): Record<ComparisonRowKind, Fact[]> {
  const {lookup, sense, varietyName} = side;
  const lexeme = lookup.lexemes.find(each => each.index === sense.lexeme);
  const word = lexeme ? lexemeFacts(lexeme, lookup.language, varietyName) : null;
  const meaning = senseFacts(sense, lookup.language, varietyName, locale);
  const plain = (texts: (string | null | undefined)[]): Fact[] =>
    [...new Set(texts.filter((text): text is string => !!text))].map(text => ({text, note: ''}));
  // A verb whose every form follows the rule has nothing a learner could not guess; the sheet still lists them.
  const regular = lexeme?.grammar['irregular'] === false;
  return {
    level: plain([sense.cefr]),
    use: plain(meaning.marks),
    grammar: plain([...(word?.grammar ?? []), ...meaning.grammar, word?.note, meaning.note]),
    pattern: plain(sense.frames),
    often: plain(sense.collocations),
    opposite: plain(sense.antonyms),
    forms: regular ? [] : (word?.forms ?? [])
      .filter(form => !form.senses.length || form.senses.includes(sense.index))
      .map(form => ({text: form.reading ?? form.form, note: form.label})),
    spelled: (word?.spellings ?? []).map(spelling => ({text: spelling.text, note: spelling.where})),
  };
}

function key(fact: Fact): string {
  return `${fact.text.toLocaleLowerCase()}\n${fact.note.toLocaleLowerCase()}`;
}

/** The rows either word has something for; one neither has anything for is left out. */
export function comparisonRows(first: ComparedSide, second: ComparedSide, locale: string): ComparisonRow[] {
  const [a, b] = [facts(first, locale), facts(second, locale)];
  return ROW_ORDER.filter(kind => a[kind].length || b[kind].length).map(kind => {
    const [left, right] = [new Set(a[kind].map(key)), new Set(b[kind].map(key))];
    return {
      kind,
      cells: [
        a[kind].map(fact => ({...fact, shared: right.has(key(fact))})),
        b[kind].map(fact => ({...fact, shared: left.has(key(fact))})),
      ],
      same: left.size > 0 && left.size === right.size && [...left].every(each => right.has(each)),
    };
  });
}

/** Every way a sheet names its word, in lower case: what was looked up, its lemmas, its senses' headwords. */
function names(lookup: DiscoverLookup): Set<string> {
  return new Set([lookup.entry, ...lookup.lexemes.map(lexeme => lexeme.lemma), ...lookup.senses.map(sense => sense.headword)]
    .map(name => name.toLocaleLowerCase()));
}

function wordsOf(text: string | null): Set<string> {
  return new Set((text ?? '').toLocaleLowerCase().match(/[\p{L}\p{M}]+/gu) ?? []);
}

function sharedCount(a: string[], b: string[]): number {
  const other = new Set(b.map(each => each.toLocaleLowerCase()));
  return a.filter(each => other.has(each.toLocaleLowerCase())).length;
}

/**
 * The meanings the two words are first compared by, as positions in the given lists: the pair that most plainly
 * belongs together. Two senses are near when they share a translation, when one is defined with the other word ("big:
 * large in size") or names it as its opposite, when they share an opposite and when they are the same part of speech.
 * Every step down either list costs a little, so a shared part of speech alone does not pull a rare sense up: affect
 * and effect are compared as the verb and the noun their sheets lead with, not as the two verbs.
 */
export function bestPair(first: DiscoverLookup, firstSenses: DiscoverSense[], second: DiscoverLookup, secondSenses: DiscoverSense[]): [number, number] {
  const [firstNames, secondNames] = [names(first), names(second)];
  const mentions = (sense: DiscoverSense, others: Set<string>) => [...wordsOf(sense.definition)].some(word => others.has(word))
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
 * How a word is said in the meaning compared: the reading that meaning takes, in the wanted variety when the entry
 * has it and in the entry's first otherwise. Null when the entry transcribes nothing.
 */
export function soundOf(lookup: DiscoverLookup, sense: DiscoverSense, variety: string | null): DiscoverPronunciation | null {
  const taking = lookup.pronunciations.filter(pronunciation => pronunciation.senses.includes(sense.index));
  const readings = taking.length ? taking : lookup.pronunciations;
  const wanted = variety?.toLowerCase();
  return readings.find(pronunciation => pronunciation.variety.toLowerCase() === wanted) ?? readings[0] ?? null;
}

/**
 * What the lexicon says of the two words together, as short lines over the table: that they are mixed up, belong to
 * one family, are opposites, are said alike, or are translated by the same word. Empty when it links them nowhere.
 */
export function comparisonLinks(first: ComparedSide, second: ComparedSide): string[] {
  const lines: string[] = [];
  const sides = [first, second];
  const named = sides.map(side => names(side.lookup));
  const relations = sides.flatMap((side, at) => side.lookup.lexemes.flatMap(lexeme => lexeme.relations
    .filter(relation => named[1 - at].has(relation.lemma.toLocaleLowerCase()))
    .map(relation => ({lexeme, relation}))));
  const types = new Set(relations.map(({relation}) => relation.type));
  if (types.has('confusable')) lines.push($localize`Often confused with each other`);
  if (types.has('family')) lines.push($localize`From the same word family`);
  const other = relations.find(({relation}) => relation.type !== 'confusable' && relation.type !== 'family');
  if (other) lines.push(`${other.lexeme.lemma}: ${relationLabel(other.relation)} ${other.relation.lemma}`);
  const opposite = sides.some((side, at) => side.lookup.senses.some(sense => sense.antonyms.some(antonym => named[1 - at].has(antonym.toLocaleLowerCase()))));
  if (opposite) lines.push($localize`Opposites`);
  const alike = sides.flatMap((side, at) => side.lookup.homophones
    .filter(homophone => named[1 - at].has(homophone.word.toLocaleLowerCase()))
    .map(homophone => ({side, homophone})))[0];
  if (alike) {
    const said = new Set(alike.side.lookup.pronunciations.map(pronunciation => pronunciation.variety));
    const everywhere = [...said].every(variety => alike.homophone.varieties.includes(variety));
    const where = alike.homophone.varieties.filter(variety => said.has(variety)).map(alike.side.varietyName).join(', ');
    lines.push(everywhere || !where ? $localize`Said exactly alike` : $localize`Said exactly alike in ${where}:varieties:`);
  }
  const translations = first.sense.translations.filter(translation =>
    second.sense.translations.some(each => each.toLocaleLowerCase() === translation.toLocaleLowerCase()));
  if (translations.length) lines.push($localize`Both translate as ${translations.join(', ')}:translations:`);
  return lines;
}
