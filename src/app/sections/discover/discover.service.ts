import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {AppConstants} from '../../app.constants';
import {LanguageCode} from '../../models/language.enum';
import {expectArray, expectEnum, expectNullableString, expectNumber, expectRecord, expectString} from '../../shared/runtime-validation';

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
  headword: string;
  partOfSpeech: string | null;
  transcription: string | null;
  translations: string[];
  /** Lexicon fields; null or empty when the entry came from another provider. */
  definition: string | null;
  cefr: string | null;
  examples: DiscoverExample[];
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

  lookup(entry: string, language: LanguageCode, translationLanguage: LanguageCode, context?: string): Observable<DiscoverLookup> {
    let params = new HttpParams().set('entry', entry);
    if (context) params = params.set('context', context);
    return this.http.get<unknown>(
      `${AppConstants.PUBLIC_URL}/discover/lookup/${language}/${translationLanguage}`,
      {params},
    ).pipe(map(parseDiscoverLookup));
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
    senses: expectArray(data['senses'], 'discoverLookup.senses').map((value, index) => {
      const sense = expectRecord(value, `discoverLookup.senses[${index}]`);
      return {
        index: expectNumber(sense['index'], `discoverLookup.senses[${index}].index`),
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
      };
    }),
  };
}

/** An additive list field: a backend that does not send it yet reads as empty. */
function parseOptionalArray(value: unknown, path: string): unknown[] {
  return value == null ? [] : expectArray(value, path);
}
