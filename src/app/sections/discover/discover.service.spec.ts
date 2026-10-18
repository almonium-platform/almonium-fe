import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {firstValueFrom} from 'rxjs';
import {AppConstants} from '../../app.constants';
import {LanguageCode} from '../../models/language.enum';
import {DiscoverService, parseDiscoverLookup} from './discover.service';

describe('DiscoverService', () => {
  let service: DiscoverService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    service = TestBed.inject(DiscoverService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests a public lookup with source context', async () => {
    const result = firstValueFrom(service.lookup('Ausgabe', LanguageCode.DE, LanguageCode.EN, 'Die Ausgabe erschien.'));
    const request = http.expectOne(req => req.url === `${AppConstants.PUBLIC_URL}/discover/lookup/DE/EN`);
    expect(request.request.params.get('entry')).toBe('Ausgabe');
    expect(request.request.params.get('context')).toBe('Die Ausgabe erschien.');
    request.flush({
      entry: 'Ausgabe', sourceContext: 'Die Ausgabe erschien.', language: 'DE', translationLanguage: 'EN', provider: 'dictionary',
      frequency: {score: 64, band: 'Common in books', provenance: 'ngrams.dev · ger corpus · relative frequency'},
      senses: [{index: 1, headword: 'die Ausgabe', partOfSpeech: 'noun', transcription: 'aʊsɡaːbə', translations: ['edition']}],
    });
    expect((await result).senses[0].translations).toEqual(['edition']);
  });

  it('accepts an honest degraded lookup without provider data', () => {
    expect(parseDiscoverLookup({
      entry: 'Ausgabe', sourceContext: null, language: 'DE', translationLanguage: 'EN', provider: null, frequency: null, senses: [],
    }).senses).toEqual([]);
  });

  it('reads the lexicon fields: pronunciations, definition, level and examples', () => {
    const lookup = parseDiscoverLookup({
      entry: 'colour', sourceContext: null, language: 'EN', translationLanguage: 'UK', provider: 'lexicon', frequency: null,
      pronunciations: [
        {variety: 'en-GB', ipa: 'ˈkʌlə', clipUrl: '/public/lexicon/clips/0b7c1b6e-9d8d-4c2a-9f1e-3a2d6c5b4a10', clipStatus: 'verified'},
        {variety: 'en-US', ipa: 'ˈkʌlɚ', clipUrl: null, clipStatus: null},
      ],
      senses: [{
        index: 1, headword: 'colour', partOfSpeech: 'noun', transcription: null, translations: ['колір'],
        definition: 'The property of an object that depends on the light it reflects.', cefr: 'A1',
        examples: [{text: 'What colour is it?', translation: 'Якого воно кольору?'}, {text: 'A splash of colour.', translation: null}],
      }],
    });
    expect(lookup.pronunciations).toEqual([
      {variety: 'en-GB', ipa: 'ˈkʌlə', clipUrl: '/public/lexicon/clips/0b7c1b6e-9d8d-4c2a-9f1e-3a2d6c5b4a10', clipStatus: 'verified'},
      {variety: 'en-US', ipa: 'ˈkʌlɚ', clipUrl: null, clipStatus: null},
    ]);
    expect(lookup.senses[0].definition).toBe('The property of an object that depends on the light it reflects.');
    expect(lookup.senses[0].cefr).toBe('A1');
    expect(lookup.senses[0].examples).toEqual([
      {text: 'What colour is it?', translation: 'Якого воно кольору?'},
      {text: 'A splash of colour.', translation: null},
    ]);
  });

  it('reads a response from a backend that does not send the lexicon fields yet', () => {
    const lookup = parseDiscoverLookup({
      entry: 'Ausgabe', sourceContext: null, language: 'DE', translationLanguage: 'EN', provider: 'dictionary', frequency: null,
      senses: [{index: 1, headword: 'die Ausgabe', partOfSpeech: 'noun', transcription: 'aʊsɡaːbə', translations: ['edition']}],
    });
    expect(lookup.pronunciations).toEqual([]);
    expect(lookup.senses[0].definition).toBeNull();
    expect(lookup.senses[0].cefr).toBeNull();
    expect(lookup.senses[0].examples).toEqual([]);
  });

  it('rejects a clip status outside the contract', () => {
    expect(() => parseDiscoverLookup({
      entry: 'colour', sourceContext: null, language: 'EN', translationLanguage: 'UK', provider: 'lexicon', frequency: null, senses: [],
      pronunciations: [{variety: 'en-GB', ipa: null, clipUrl: null, clipStatus: 'pending'}],
    })).toThrowError(/discoverLookup.pronunciations\[0\].clipStatus/);
  });

  it('still rejects a response missing the established fields', () => {
    expect(() => parseDiscoverLookup({entry: 'colour', language: 'EN', translationLanguage: 'UK', pronunciations: []}))
      .toThrowError(/discoverLookup.senses/);
  });
});
