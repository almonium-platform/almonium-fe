import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {AppConstants} from '../../app.constants';
import {LanguageCode} from '../../models/language.enum';
import {expectArray, expectNumber, expectRecord, expectString} from '../../shared/runtime-validation';

export interface DiscoverFrequency {
  score: number;
  band: string;
  provenance: string;
}

export interface DiscoverSense {
  index: number;
  headword: string;
  partOfSpeech: string | null;
  transcription: string | null;
  translations: string[];
}

export interface DiscoverLookup {
  entry: string;
  sourceContext: string | null;
  language: LanguageCode;
  translationLanguage: LanguageCode;
  provider: string | null;
  frequency: DiscoverFrequency | null;
  senses: DiscoverSense[];
}

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
      };
    }),
  };
}
