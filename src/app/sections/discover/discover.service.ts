import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map, tap} from 'rxjs/operators';
import {AppConstants} from '../../app.constants';
import {LanguageCode} from '../../models/language.enum';
import {expectArray, expectBoolean, expectEnum, expectNullableString, expectNumber, expectRecord, expectString} from '../../shared/runtime-validation';
import {AnalyticsService} from '../../services/analytics/analytics.service';

export interface DiscoverFrequency {
  score: number;
  band: string;
  provenance: string;
}

export interface DiscoverExample {
  text: string;
  translation: string | null;
}

export interface DiscoverSense {
  index: number;
  /** The lexicon sense's identity across rewrites of its entry, kept on a card saved from it; null from other providers. */
  key: string | null;
  headword: string;
  partOfSpeech: string | null;
  transcription: string | null;
  translations: string[];
  /** Lexicon fields; null or empty when the entry came from another provider. */
  definition: string | null;
  cefr: string | null;
  examples: DiscoverExample[];
  /** `DiscoverLexeme.index` of the word the sense belongs to; null from other providers. */
  lexeme: number | null;
  labels: DiscoverLabels;
  /** Where the sense is used, when not everywhere the language is spoken. */
  regions: DiscoverRegion[];
  /** What differs from the word's own grammar in this sense, by the lexicon's keys (countability, valency, note). */
  grammar: DiscoverGrammar;
  /** How the word is built into a sentence, every open place marked: "decide on sth". */
  frames: string[];
  /** The words the sense is commonly said with, the less guessable first. */
  collocations: string[];
  antonyms: string[];
  /** The standard word for a nonstandard one. */
  standardAlternative: string | null;
}

/** What kind of word a sense is, each axis by itself; the lexicon's own keys, absent ones null, empty or false. */
export interface DiscoverLabels {
  formality: string | null;
  attitude: string[];
  time: string | null;
  style: string[];
  normativity: string | null;
  domain: string | null;
  politeness: string | null;
  figurative: boolean;
  rare: boolean;
}

/** What a sense has of the lexicon's fields when no lexicon entry stands behind it: nothing. */
export const NO_ENTRY: Pick<DiscoverSense, 'lexeme' | 'labels' | 'regions' | 'grammar' | 'frames' | 'collocations' | 'antonyms' | 'standardAlternative'> = {
  lexeme: null,
  labels: {formality: null, attitude: [], time: null, style: [], normativity: null, domain: null, politeness: null, figurative: false, rare: false},
  regions: [],
  grammar: {},
  frames: [],
  collocations: [],
  antonyms: [],
  standardAlternative: null,
};

/** The language with a country (en-GB) or a UN area (es-419), and whether the sense is used only or mainly there. */
export interface DiscoverRegion {
  variety: string;
  extent: string;
}

/** Grammar as the lexicon writes it: gender "Fem", countability "Mass", irregular true, mainly ["position"]. */
export type DiscoverGrammar = Record<string, unknown>;

export interface DiscoverSpelling {
  text: string;
  /** The varieties that write it so; empty for all of them. */
  varieties: string[];
  preReform: boolean;
}

export interface DiscoverForm {
  form: string;
  /** Universal Dependencies features: {Number: "Plur"}, {Tense: "Past", VerbForm: "Part"}. */
  features: Record<string, string>;
  varieties: string[];
  /** `DiscoverSense.index` of the senses the form belongs to; empty for all. */
  senses: number[];
  reading: string | null;
  note: string | null;
}

export interface DiscoverRelation {
  /** derived_from, diminutive_of, confusable and the lexicon's other kinds. */
  type: string;
  lemma: string;
  partOfSpeech: string | null;
  senses: number[];
}

/** One word behind the sheet's senses: a lemma in one part of speech, with what holds for all its senses. */
export interface DiscoverLexeme {
  index: number;
  lemma: string;
  partOfSpeech: string;
  /** word, multiword or contraction. */
  kind: string;
  grammar: DiscoverGrammar;
  /** Every way the word is written, when there is more than one. */
  spellings: DiscoverSpelling[];
  /** The forms a learner could not guess. */
  forms: DiscoverForm[];
  relations: DiscoverRelation[];
}

/** Whether a machine check confirmed the clip says the word; null when the clip was never checked. */
export type DiscoverClipStatus = 'verified' | 'unverified';

export interface DiscoverPronunciation {
  /** BCP-47 tag of the variety spoken, matching `LanguageVariety.tag`. */
  variety: string;
  ipa: string | null;
  /** API-relative path of the audio clip, such as `/public/lexicon/clips/<uuid>`; null when there is none. */
  clipUrl: string | null;
  clipStatus: DiscoverClipStatus | null;
  /** `ipa` cut where it parts from the other varieties' transcriptions; null without a transcription. */
  segments: DiscoverIpaSegment[] | null;
  /**
   * `DiscoverSense.index` of every sense said this way. A variety's readings with the same senses are free
   * alternatives (niche); different senses mean the reading follows the meaning (live, bow).
   */
  senses: number[];
}

/** A run of a transcription, and whether another variety says it differently there (design 5a). */
export interface DiscoverIpaSegment {
  text: string;
  differs: boolean;
}

/** A word said exactly like the sheet's, in `varieties`, for the senses (`DiscoverSense.index`) of the lexemes it sounds like. */
export interface DiscoverHomophone {
  word: string;
  varieties: string[];
  senses: number[];
}

export interface DiscoverLookup {
  entry: string;
  sourceContext: string | null;
  language: LanguageCode;
  translationLanguage: LanguageCode;
  provider: string | null;
  frequency: DiscoverFrequency | null;
  /** Empty when the backend sends none; the lexicon provider fills it. */
  pronunciations: DiscoverPronunciation[];
  senses: DiscoverSense[];
  /** Empty when the backend sends none; only the lexicon provider fills it. */
  homophones: DiscoverHomophone[];
  /** The words the senses belong to; empty unless the lexicon answered. */
  lexemes: DiscoverLexeme[];
  /** When a standalone miss was answered in another language, the language originally asked for. */
  requestedLanguage: LanguageCode | null;
  /** Other lexicon languages that also hold the word. */
  availableLanguages: LanguageCode[];
  /** True when the word is written in an alphabet the requested language does not use. */
  scriptMismatch: boolean;
}

/** A headword offered while a word is being typed, with what the field shows beside it. */
export interface DiscoverSuggestion {
  headword: string;
  partOfSpeech: string | null;
  /** Fem, Masc or Neut where the language marks gender; null otherwise. */
  gender: string | null;
  /** The first gloss of the first sense, in the reader's language; null when the entry has none in it. */
  gloss: string | null;
}

const CLIP_STATUSES: readonly DiscoverClipStatus[] = ['verified', 'unverified'];

@Injectable({providedIn: 'root'})
export class DiscoverService {
  private readonly http = inject(HttpClient);
  private readonly analytics = inject(AnalyticsService);

  lookup(entry: string, language: LanguageCode, translationLanguage: LanguageCode, context?: string): Observable<DiscoverLookup> {
    let params = new HttpParams().set('entry', entry);
    if (context) params = params.set('context', context);
    return this.http.get<unknown>(
      `${AppConstants.PUBLIC_URL}/discover/lookup/${language}/${translationLanguage}`,
      {params},
    ).pipe(
      map(parseDiscoverLookup),
      tap(() => this.analytics.trackFirst('first_lookup', {language})),
    );
  }

  /** Headwords beginning with what was typed, most frequent first; the lexicon's word for "autocomplete". */
  suggest(prefix: string, language: LanguageCode, glossLanguage: LanguageCode): Observable<DiscoverSuggestion[]> {
    const params = new HttpParams().set('prefix', prefix).set('fluent', glossLanguage.toLowerCase()).set('limit', 6);
    return this.http.get<unknown>(`${AppConstants.PUBLIC_URL}/lexicon/${language.toLowerCase()}/suggestions`, {params})
      .pipe(map(parseDiscoverSuggestions));
  }
}

export function parseDiscoverSuggestions(value: unknown): DiscoverSuggestion[] {
  return expectArray(value, 'suggestions').map((item, index) => {
    const row = expectRecord(item, `suggestions[${index}]`);
    return {
      headword: expectString(row['headword'], `suggestions[${index}].headword`),
      partOfSpeech: expectNullableString(row['pos'], `suggestions[${index}].pos`),
      gender: expectNullableString(row['gender'], `suggestions[${index}].gender`),
      gloss: expectNullableString(row['gloss'], `suggestions[${index}].gloss`),
    };
  });
}

export function parseDiscoverLookup(value: unknown): DiscoverLookup {
  const data = expectRecord(value, 'discoverLookup');
  const frequencyData = data['frequency'] == null ? null : expectRecord(data['frequency'], 'discoverLookup.frequency');
  return {
    entry: expectString(data['entry'], 'discoverLookup.entry'),
    sourceContext: data['sourceContext'] == null ? null : expectString(data['sourceContext'], 'discoverLookup.sourceContext'),
    language: expectString(data['language'], 'discoverLookup.language') as LanguageCode,
    translationLanguage: expectString(data['translationLanguage'], 'discoverLookup.translationLanguage') as LanguageCode,
    provider: data['provider'] == null ? null : expectString(data['provider'], 'discoverLookup.provider'),
    frequency: frequencyData == null ? null : {
      score: expectNumber(frequencyData['score'], 'discoverLookup.frequency.score'),
      band: expectString(frequencyData['band'], 'discoverLookup.frequency.band'),
      provenance: expectString(frequencyData['provenance'], 'discoverLookup.frequency.provenance'),
    },
    homophones: parseOptionalArray(data['homophones'], 'discoverLookup.homophones').map((value, index) => {
      const homophone = expectRecord(value, `discoverLookup.homophones[${index}]`);
      return {
        word: expectString(homophone['word'], `discoverLookup.homophones[${index}].word`),
        varieties: expectArray(homophone['varieties'], `discoverLookup.homophones[${index}].varieties`)
          .map((variety, at) => expectString(variety, `discoverLookup.homophones[${index}].varieties[${at}]`)),
        senses: expectArray(homophone['senses'], `discoverLookup.homophones[${index}].senses`)
          .map((sense, at) => expectNumber(sense, `discoverLookup.homophones[${index}].senses[${at}]`)),
      };
    }),
    senses: expectArray(data['senses'], 'discoverLookup.senses').map((value, index) => {
      const sense = expectRecord(value, `discoverLookup.senses[${index}]`);
      return {
        index: expectNumber(sense['index'], `discoverLookup.senses[${index}].index`),
        key: sense['key'] === undefined ? null : expectNullableString(sense['key'], `discoverLookup.senses[${index}].key`),
        headword: expectString(sense['headword'], `discoverLookup.senses[${index}].headword`),
        partOfSpeech: sense['partOfSpeech'] == null ? null : expectString(sense['partOfSpeech'], `discoverLookup.senses[${index}].partOfSpeech`),
        transcription: sense['transcription'] == null ? null : expectString(sense['transcription'], `discoverLookup.senses[${index}].transcription`),
        translations: expectArray(sense['translations'], `discoverLookup.senses[${index}].translations`)
          .map((translation, translationIndex) => expectString(translation, `discoverLookup.senses[${index}].translations[${translationIndex}]`)),
        definition: expectNullableString(sense['definition'], `discoverLookup.senses[${index}].definition`),
        cefr: expectNullableString(sense['cefr'], `discoverLookup.senses[${index}].cefr`),
        examples: parseOptionalArray(sense['examples'], `discoverLookup.senses[${index}].examples`).map((value, exampleIndex) => {
          const example = expectRecord(value, `discoverLookup.senses[${index}].examples[${exampleIndex}]`);
          return {
            text: expectString(example['text'], `discoverLookup.senses[${index}].examples[${exampleIndex}].text`),
            translation: expectNullableString(example['translation'], `discoverLookup.senses[${index}].examples[${exampleIndex}].translation`),
          };
        }),
        lexeme: sense['lexeme'] == null ? null : expectNumber(sense['lexeme'], `discoverLookup.senses[${index}].lexeme`),
        labels: parseLabels(sense['labels'], `discoverLookup.senses[${index}].labels`),
        regions: parseOptionalArray(sense['regions'], `discoverLookup.senses[${index}].regions`).map((value, at) => {
          const region = expectRecord(value, `discoverLookup.senses[${index}].regions[${at}]`);
          return {
            variety: expectString(region['variety'], `discoverLookup.senses[${index}].regions[${at}].variety`),
            extent: expectString(region['extent'], `discoverLookup.senses[${index}].regions[${at}].extent`),
          };
        }),
        grammar: sense['grammar'] == null ? {} : expectRecord(sense['grammar'], `discoverLookup.senses[${index}].grammar`),
        frames: parseStrings(sense['frames'], `discoverLookup.senses[${index}].frames`),
        collocations: parseStrings(sense['collocations'], `discoverLookup.senses[${index}].collocations`),
        antonyms: parseStrings(sense['antonyms'], `discoverLookup.senses[${index}].antonyms`),
        standardAlternative: sense['standardAlternative'] == null
          ? null
          : expectString(sense['standardAlternative'], `discoverLookup.senses[${index}].standardAlternative`),
      };
    }),
    lexemes: parseOptionalArray(data['lexemes'], 'discoverLookup.lexemes').map((value, index) => {
      const path = `discoverLookup.lexemes[${index}]`;
      const lexeme = expectRecord(value, path);
      return {
        index: expectNumber(lexeme['index'], `${path}.index`),
        lemma: expectString(lexeme['lemma'], `${path}.lemma`),
        partOfSpeech: expectString(lexeme['partOfSpeech'], `${path}.partOfSpeech`),
        kind: expectString(lexeme['kind'], `${path}.kind`),
        grammar: lexeme['grammar'] == null ? {} : expectRecord(lexeme['grammar'], `${path}.grammar`),
        spellings: parseOptionalArray(lexeme['spellings'], `${path}.spellings`).map((value, at) => {
          const spelling = expectRecord(value, `${path}.spellings[${at}]`);
          return {
            text: expectString(spelling['text'], `${path}.spellings[${at}].text`),
            varieties: parseStrings(spelling['varieties'], `${path}.spellings[${at}].varieties`),
            preReform: spelling['pre_reform'] === true,
          };
        }),
        forms: parseOptionalArray(lexeme['forms'], `${path}.forms`).map((value, at) => {
          const form = expectRecord(value, `${path}.forms[${at}]`);
          const features = form['features'] == null ? {} : expectRecord(form['features'], `${path}.forms[${at}].features`);
          return {
            form: expectString(form['form'], `${path}.forms[${at}].form`),
            // A person may come as a number (3); every feature is read as its text.
            features: Object.fromEntries(Object.entries(features).map(([name, feature]) => [name, String(feature)])),
            varieties: parseStrings(form['varieties'], `${path}.forms[${at}].varieties`),
            senses: parseOptionalArray(form['senses'], `${path}.forms[${at}].senses`)
              .map((sense, senseAt) => expectNumber(sense, `${path}.forms[${at}].senses[${senseAt}]`)),
            reading: form['reading'] == null ? null : expectString(form['reading'], `${path}.forms[${at}].reading`),
            note: form['note'] == null ? null : expectString(form['note'], `${path}.forms[${at}].note`),
          };
        }),
        relations: parseOptionalArray(lexeme['relations'], `${path}.relations`).map((value, at) => {
          const relation = expectRecord(value, `${path}.relations[${at}]`);
          return {
            type: expectString(relation['type'], `${path}.relations[${at}].type`),
            lemma: expectString(relation['lemma'], `${path}.relations[${at}].lemma`),
            partOfSpeech: relation['partOfSpeech'] == null ? null : expectString(relation['partOfSpeech'], `${path}.relations[${at}].partOfSpeech`),
            senses: parseOptionalArray(relation['senses'], `${path}.relations[${at}].senses`)
              .map((sense, senseAt) => expectNumber(sense, `${path}.relations[${at}].senses[${senseAt}]`)),
          };
        }),
      };
    }),
    pronunciations: parseOptionalArray(data['pronunciations'], 'discoverLookup.pronunciations').map((value, index) => {
      const pronunciation = expectRecord(value, `discoverLookup.pronunciations[${index}]`);
      return {
        variety: expectString(pronunciation['variety'], `discoverLookup.pronunciations[${index}].variety`),
        ipa: expectNullableString(pronunciation['ipa'], `discoverLookup.pronunciations[${index}].ipa`),
        clipUrl: expectNullableString(pronunciation['clipUrl'], `discoverLookup.pronunciations[${index}].clipUrl`),
        clipStatus: pronunciation['clipStatus'] == null
          ? null
          : expectEnum(pronunciation['clipStatus'], CLIP_STATUSES, `discoverLookup.pronunciations[${index}].clipStatus`),
        segments: pronunciation['segments'] == null
          ? null
          : expectArray(pronunciation['segments'], `discoverLookup.pronunciations[${index}].segments`).map((value, segmentIndex) => {
            const segment = expectRecord(value, `discoverLookup.pronunciations[${index}].segments[${segmentIndex}]`);
            return {
              text: expectString(segment['text'], `discoverLookup.pronunciations[${index}].segments[${segmentIndex}].text`),
              differs: expectBoolean(segment['differs'], `discoverLookup.pronunciations[${index}].segments[${segmentIndex}].differs`),
            };
          }),
        senses: expectArray(pronunciation['senses'], `discoverLookup.pronunciations[${index}].senses`)
          .map((value, senseIndex) => expectNumber(value, `discoverLookup.pronunciations[${index}].senses[${senseIndex}]`)),
      };
    }),
    requestedLanguage: data['requestedLanguage'] == null
      ? null
      : expectString(data['requestedLanguage'], 'discoverLookup.requestedLanguage') as LanguageCode,
    availableLanguages: parseOptionalArray(data['availableLanguages'], 'discoverLookup.availableLanguages')
      .map((language, index) => expectString(language, `discoverLookup.availableLanguages[${index}]`) as LanguageCode),
    scriptMismatch: data['scriptMismatch'] === true,
  };
}

function parseStrings(value: unknown, path: string): string[] {
  return parseOptionalArray(value, path).map((item, index) => expectString(item, `${path}[${index}]`));
}

/** The lexicon leaves out a label that does not apply, so each axis reads as null, empty or false when absent. */
function parseLabels(value: unknown, path: string): DiscoverLabels {
  const labels = value == null ? {} : expectRecord(value, path);
  const one = (key: string): string | null => labels[key] == null ? null : expectString(labels[key], `${path}.${key}`);
  return {
    formality: one('formality'),
    attitude: parseStrings(labels['attitude'], `${path}.attitude`),
    time: one('time'),
    style: parseStrings(labels['style'], `${path}.style`),
    normativity: one('normativity'),
    domain: one('domain'),
    politeness: one('politeness'),
    figurative: labels['figurative'] === true,
    rare: labels['rare'] === true,
  };
}

/** An additive list field: a backend that does not send it yet reads as empty. */
function parseOptionalArray(value: unknown, path: string): unknown[] {
  return value == null ? [] : expectArray(value, path);
}
