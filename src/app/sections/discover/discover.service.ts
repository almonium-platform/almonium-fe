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
