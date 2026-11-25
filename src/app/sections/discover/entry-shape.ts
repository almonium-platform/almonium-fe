import {DiscoverForm, DiscoverGrammar, DiscoverLabels, DiscoverLexeme, DiscoverRegion, DiscoverRelation, DiscoverSense} from './discover.service';

/**
 * The lexicon's keys in the words the sheet prints. An entry says what a word is with closed sets of keys (a label
 * "informal", a grammar value "Mass", a form's feature "Plur"); this file is the one place they become text. A key
 * this build does not know is shown as it came, so a new label reads plainly before it is named here.
 */

/** How a variety tag is named on the sheet: "British" for en-GB. The component passes its own catalogue lookup. */
export type VarietyNamer = (tag: string) => string;

const LABELS: Record<string, string> = {
  formal: $localize`formal`, informal: $localize`informal`, slang: $localize`slang`,
  derogatory: $localize`derogatory`, offensive: $localize`offensive`, vulgar: $localize`vulgar`, humorous: $localize`humorous`,
  ironic: $localize`ironic`, euphemistic: $localize`euphemistic`, endearing: $localize`endearing`, disapproving: $localize`disapproving`,
  dated: $localize`dated`, archaic: $localize`archaic`, historical: $localize`historical`,
  literary: $localize`literary`, poetic: $localize`poetic`, elevated: $localize`elevated`, official: $localize`official`,
  nonstandard: $localize`nonstandard`, proscribed: $localize`often considered wrong`,
  familiar: $localize`familiar`, polite: $localize`polite`, honorific: $localize`honorific`, humble: $localize`humble`,
};

const DOMAINS: Record<string, string> = {
  agriculture: $localize`agriculture`, anatomy: $localize`anatomy`, architecture: $localize`architecture`, art: $localize`art`,
  astronomy: $localize`astronomy`, aviation: $localize`aviation`, biology: $localize`biology`, botany: $localize`botany`,
  chemistry: $localize`chemistry`, computing: $localize`computing`, cooking: $localize`cooking`, economics: $localize`economics`,
  education: $localize`education`, electricity: $localize`electricity`, finance: $localize`finance`, fishing: $localize`fishing`,
  geography: $localize`geography`, geology: $localize`geology`, grammar: $localize`grammar`, history: $localize`history`,
  hunting: $localize`hunting`, law: $localize`law`, linguistics: $localize`linguistics`, literature: $localize`literature`,
  mathematics: $localize`mathematics`, medicine: $localize`medicine`, military: $localize`military`, music: $localize`music`,
  mythology: $localize`mythology`, nautical: $localize`nautical`, philosophy: $localize`philosophy`, photography: $localize`photography`,
  physics: $localize`physics`, politics: $localize`politics`, psychology: $localize`psychology`, religion: $localize`religion`,
  sport: $localize`sport`, technology: $localize`technology`, theatre: $localize`theatre`, transport: $localize`transport`,
  zoology: $localize`zoology`,
};

/** A grammar value in words, by key; a value under `mainly` is said with "usually" in front. */
const GRAMMAR: Record<string, Record<string, string>> = {
  countability: {Count: $localize`countable`, Mass: $localize`uncountable`, Both: $localize`countable or uncountable`},
  valency: {
    Tr: $localize`transitive`, Intr: $localize`intransitive`, Both: $localize`transitive or intransitive`,
    Refl: $localize`reflexive`, Impers: $localize`impersonal`,
  },
  number: {Sing: $localize`singular only`, Plur: $localize`plural only`},
  position: {Attr: $localize`only before a noun`, Pred: $localize`not before a noun`},
  aspect: {Imp: $localize`imperfective`, Perf: $localize`perfective`},
  animacy: {Anim: $localize`animate`, Inan: $localize`inanimate`},
  gender: {Masc: $localize`masculine`, Fem: $localize`feminine`, Neut: $localize`neuter`, Com: $localize`common gender`},
};

/** The same values where they hold for most uses, not all. */
const MAINLY: Record<string, Record<string, string>> = {
  countability: {Count: $localize`usually countable`, Mass: $localize`usually uncountable`},
  valency: {Tr: $localize`usually transitive`, Intr: $localize`usually intransitive`},
  number: {Sing: $localize`usually singular`, Plur: $localize`usually plural`},
  position: {Attr: $localize`usually before a noun`, Pred: $localize`usually not before a noun`},
};

/** A grammar key that is true or false, in words; a pair is [when true, when false], an empty word says nothing. */
const FLAGS: Record<string, [string, string]> = {
  irregular: [$localize`irregular`, ''],
  reflexive: [$localize`reflexive`, ''],
  separable: [$localize`separable`, $localize`inseparable`],
  invariable: [$localize`never changes its form`, ''],
  comparable: ['', $localize`not comparable`],
  h_aspire: [$localize`h aspiré`, ''],
  suru: [$localize`makes a verb with する`, ''],
};

/** The perfect auxiliary in the language's own word: a German verb takes "sein", a French one "être". */
const AUXILIARIES: Record<string, {have: string; be: string}> = {
  DE: {have: 'haben', be: 'sein'}, FR: {have: 'avoir', be: 'être'}, IT: {have: 'avere', be: 'essere'},
  PT: {have: 'ter', be: 'ser'}, ES: {have: 'haber', be: 'ser'}, NL: {have: 'hebben', be: 'zijn'},
};

const GERMAN_ARTICLES: Record<string, string> = {Masc: 'der', Fem: 'die', Neut: 'das'};

const FEATURES: Record<string, Record<string, string>> = {
  Number: {Sing: $localize`singular`, Plur: $localize`plural`, Dual: $localize`dual`},
  Case: {
    Nom: $localize`nominative`, Gen: $localize`genitive`, Dat: $localize`dative`, Acc: $localize`accusative`,
    Ins: $localize`instrumental`, Loc: $localize`locative`, Voc: $localize`vocative`,
  },
  Gender: {Masc: $localize`masculine`, Fem: $localize`feminine`, Neut: $localize`neuter`},
  Degree: {Cmp: $localize`comparative`, Sup: $localize`superlative`},
  Mood: {Sub: $localize`subjunctive`, Imp: $localize`imperative`, Cnd: $localize`conditional`},
  Tense: {Past: $localize`past`, Pres: $localize`present`, Fut: $localize`future`, Imp: $localize`imperfect`, Pqp: $localize`pluperfect`},
  Person: {1: $localize`1st person`, 2: $localize`2nd person`, 3: $localize`3rd person`},
  Polite: {Infm: $localize`informal`, Form: $localize`polite`, Elev: $localize`honorific`, Humb: $localize`humble`},
};

/** The features of a form in the order a learner says them: "3rd person singular present", "genitive plural". */
const FEATURE_ORDER = ['Person', 'Gender', 'Case', 'Number', 'Degree', 'Mood', 'Tense', 'Polite'];

const RELATIONS: Record<string, string> = {
  derived_from: $localize`from`,
  diminutive_of: $localize`diminutive of`,
  augmentative_of: $localize`augmentative of`,
  endearing_of: $localize`endearing form of`,
  feminine_of: $localize`feminine of`,
  agent_noun_of: $localize`the one who does it:`,
  verbal_noun_of: $localize`noun of the verb`,
  abstract_noun_of: $localize`abstract noun of`,
  adjective_of: $localize`adjective of`,
  adverb_of: $localize`adverb of`,
  aspect_partner: $localize`aspect partner`,
  confusable: $localize`not to be confused with`,
};

/**
 * The UN M.49 areas a region may name besides a country, in the words the mobile app uses for them (its
 * `entry-shape.ts` has the same list): the browser's own names differ for two ("Northern America", "Caribbean").
 * The backend's EntrySchema.UN_REGIONS lists the same nine.
 */
const UN_AREAS: Record<string, string> = {
  '419': $localize`Latin America`, '029': $localize`the Caribbean`, '005': $localize`South America`, '013': $localize`Central America`,
  '021': $localize`North America`, '150': $localize`Europe`, '002': $localize`Africa`, '142': $localize`Asia`, '009': $localize`Oceania`,
};

/** Universal part-of-speech tags as the sheet heads its groups. */
const PARTS_OF_SPEECH: Record<string, string> = {
  ADJ: $localize`adjective`,
  ADP: $localize`preposition`,
  ADV: $localize`adverb`,
  AUX: $localize`auxiliary verb`,
  CCONJ: $localize`conjunction`,
  DET: $localize`determiner`,
  INTJ: $localize`interjection`,
  NOUN: $localize`noun`,
  NUM: $localize`numeral`,
  PART: $localize`particle`,
  PRON: $localize`pronoun`,
  PROPN: $localize`proper noun`,
  SCONJ: $localize`conjunction`,
  VERB: $localize`verb`,
};

/** "adjective" for ADJ; a tag this build does not know in lower case; nothing for none. */
export function partOfSpeechLabel(partOfSpeech: string | null): string {
  if (!partOfSpeech) return '';
  return PARTS_OF_SPEECH[partOfSpeech.toUpperCase()] ?? partOfSpeech.toLowerCase();
}

/** A language's name in the given locale, capitalised as a menu label; the code only if the browser has no name for it. */
export function languageName(language: string, locale: string): string {
  try {
    const name = new Intl.DisplayNames([locale, 'en'], {type: 'language'}).of(language.toLowerCase()) ?? language;
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  } catch {
    return language;
  }
}

function named(table: Record<string, string>, key: string): string {
  return table[key] ?? key.replace(/_/g, ' ');
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

/**
 * "Ireland", "Latin America": the country or UN area of a tag the product has no variety for. The browser names the
 * country; for all 249 its English name is the one in the mobile app's own list.
 */
function areaName(tag: string, locale: string): string {
  const area = tag.split('-')[1];
  if (!area) return tag;
  if (UN_AREAS[area]) return UN_AREAS[area];
  try {
    return new Intl.DisplayNames([locale], {type: 'region'}).of(area) ?? tag;
  } catch {
    return tag;
  }
}

/** Where a sense is used: "British", "mainly Latin America". */
export function regionLabel(region: DiscoverRegion, varietyName: VarietyNamer, locale: string): string {
  const variety = varietyName(region.variety);
  const place = variety === region.variety ? areaName(region.variety, locale) : variety;
  return region.extent === 'mainly' ? $localize`mainly ${place}:place:` : place;
}

/** What kind of word a sense is, as the short marks beside it: where it is used first, then how, then its field. */
export function senseMarks(labels: DiscoverLabels, regions: DiscoverRegion[], varietyName: VarietyNamer, locale: string): string[] {
  const keys = [labels.formality, labels.politeness, ...labels.attitude, labels.time, ...labels.style, labels.normativity]
    .filter((key): key is string => !!key);
  return [
    ...regions.map(region => regionLabel(region, varietyName, locale)),
    ...keys.map(key => named(LABELS, key)),
    ...(labels.figurative ? [$localize`figurative`] : []),
    ...(labels.rare ? [$localize`rare`] : []),
    ...(labels.domain ? [named(DOMAINS, labels.domain)] : []),
  ];
}

/**
 * Grammar in words, in the order a dictionary gives it. `language` is the entry's code in capitals: it picks the
 * auxiliary's own word, and for German the article in place of the gender's name.
 */
export function grammarMarks(grammar: DiscoverGrammar, language: string, varietyName: VarietyNamer): string[] {
  const mainly = Array.isArray(grammar['mainly']) ? grammar['mainly'] : [];
  const marks: string[] = [];
  const gender = text(grammar['gender']);
  if (gender) marks.push(language === 'DE' && GERMAN_ARTICLES[gender] ? GERMAN_ARTICLES[gender] : named(GRAMMAR['gender'], gender));
  const plural = text(grammar['plural_class']);
  if (plural) marks.push($localize`plural ${plural}:ending:`);
  for (const key of ['countability', 'number', 'valency', 'position', 'aspect', 'animacy']) {
    const value = text(grammar[key]);
    if (!value) continue;
    marks.push((mainly.includes(key) ? MAINLY[key]?.[value] : null) ?? named(GRAMMAR[key], value));
  }
  const auxiliary = text(grammar['auxiliary']);
  if (auxiliary) {
    const words = AUXILIARIES[language];
    const verb = !words ? auxiliary : auxiliary === 'both' ? $localize`${words.have}:have: or ${words.be}:be:` : words[auxiliary as 'have' | 'be'];
    marks.push($localize`with ${verb}:auxiliary:`);
  }
  for (const [key, [yes, no]] of Object.entries(FLAGS)) {
    if (typeof grammar[key] !== 'boolean') continue;
    const word = grammar[key] ? yes : no;
    if (word) marks.push(word);
  }
  const prefix = text(grammar['separable_prefix']);
  if (prefix) marks.push($localize`prefix ${prefix}:prefix:`);
  for (const key of ['conjugation', 'declension']) {
    const value = text(grammar[key]);
    if (!value) continue;
    const kind = key === 'conjugation' ? $localize`conjugation` : $localize`declension`;
    marks.push(/^\d$/.test(value) ? `${kind} ${value}` : `${value} ${kind}`);
  }
  const byVariety = grammar['by_variety'];
  if (byVariety && typeof byVariety === 'object') {
    for (const [variety, own] of Object.entries(byVariety as Record<string, DiscoverGrammar>)) {
      const differing = grammarMarks(own, language, varietyName);
      if (differing.length) marks.push(`${varietyName(variety)}: ${differing.join(', ')}`);
    }
  }
  return marks;
}

/** What a form is: "plural", "past participle", "3rd person singular present"; empty when its features say nothing. */
export function formLabel(form: DiscoverForm, varietyName: VarietyNamer): string {
  const {features} = form;
  const words = FEATURE_ORDER.filter(name => features[name])
    .map(name => features[name].split(',').map(value => named(FEATURES[name], value)).join(' / '));
  const verbForms = (features['VerbForm'] ?? '').split(',');
  if (verbForms.includes('Part')) {
    const participle = features['Tense'] === 'Past' ? $localize`past participle` : features['Tense'] === 'Pres' ? $localize`present participle` : $localize`participle`;
    const tense = words.indexOf(named(FEATURES['Tense'], features['Tense'] ?? ''));
    // "Fin,Part" is one form doing both jobs: "past and past participle".
    if (tense >= 0) words.splice(tense, 1, verbForms.includes('Fin') ? $localize`${words[tense]}:tense: and ${participle}:participle:` : participle);
    else words.push(participle);
  } else if (verbForms.includes('Inf')) words.push($localize`infinitive`);
  else if (verbForms.includes('Ger')) words.push($localize`gerund`);
  const where = form.varieties.map(varietyName);
  return [words.join(' '), ...where, form.note].filter(Boolean).join(', ');
}

/** A relation as the sheet says it, before the word it points at: "from", "diminutive of". */
export function relationLabel(relation: DiscoverRelation): string {
  return named(RELATIONS, relation.type);
}

/** What the sheet prints under a word's part of speech. */
export interface LexemeFacts {
  /** "die · plural -¨e · countable or uncountable". */
  grammar: string[];
  note: string | null;
  /** Each spelling with who writes it so: "colour" (British, Australian). */
  spellings: {text: string; where: string}[];
  forms: {form: string; reading: string | null; label: string; senses: number[]}[];
  /** `compare` marks the first mention of a word this one is mixed up with: the sheet offers the two side by side there. */
  relations: {label: string; lemma: string; partOfSpeech: string | null; senses: number[]; compare: boolean}[];
}

export function lexemeFacts(lexeme: DiscoverLexeme, language: string, varietyName: VarietyNamer): LexemeFacts {
  return {
    grammar: grammarMarks(lexeme.grammar, language, varietyName),
    note: text(lexeme.grammar['note']),
    spellings: lexeme.spellings.map(spelling => ({
      text: spelling.text,
      where: [...spelling.varieties.map(varietyName), ...(spelling.preReform ? [$localize`before the spelling reform`] : [])].join(', '),
    })),
    forms: lexeme.forms.map(form => ({form: form.form, reading: form.reading, label: formLabel(form, varietyName), senses: form.senses})),
    relations: lexeme.relations.map((relation, at) => ({
      label: relationLabel(relation), lemma: relation.lemma, partOfSpeech: relation.partOfSpeech, senses: relation.senses,
      compare: relation.type === 'confusable'
        && lexeme.relations.findIndex(each => each.type === 'confusable' && each.lemma === relation.lemma) === at,
    })),
  };
}

/** What the sheet prints on a sense besides its meaning and example. */
export interface SenseFacts {
  /** Where and how it is used, and its field: "British", "informal", "computing". */
  marks: string[];
  /** Its grammar where it differs from the word's: "uncountable", "usually plural". */
  grammar: string[];
  note: string | null;
}

export function senseFacts(sense: DiscoverSense, language: string, varietyName: VarietyNamer, locale: string): SenseFacts {
  return {
    marks: senseMarks(sense.labels, sense.regions, varietyName, locale),
    grammar: grammarMarks(sense.grammar, language, varietyName),
    note: text(sense.grammar['note']),
  };
}
