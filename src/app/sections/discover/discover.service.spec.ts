import {provideHttpClient, withXhr} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {firstValueFrom} from 'rxjs';
import {AppConstants} from '../../app.constants';
import {LanguageCode} from '../../models/language.enum';
import {DiscoverService, parseDiscoverLookup, NO_ENTRY} from './discover.service';

describe('DiscoverService', () => {
  let service: DiscoverService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient(withXhr()), provideHttpClientTesting()]});
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

  it('reads the words said alike, and none when the backend sends no list', () => {
    const lookup = parseDiscoverLookup({
      entry: 'site', sourceContext: null, language: 'EN', translationLanguage: 'UK', provider: 'lexicon', frequency: null, senses: [],
      homophones: [{word: 'sight', varieties: ['en-GB', 'en-US'], senses: [1, 2]}],
    });
    expect(lookup.homophones).toEqual([{word: 'sight', varieties: ['en-GB', 'en-US'], senses: [1, 2]}]);
    expect(parseDiscoverLookup({
      entry: 'site', sourceContext: null, language: 'EN', translationLanguage: 'UK', provider: null, frequency: null, senses: [],
    }).homophones).toEqual([]);
  });

  it('accepts an honest degraded lookup without provider data', () => {
    expect(parseDiscoverLookup({
      entry: 'Ausgabe', sourceContext: null, language: 'DE', translationLanguage: 'EN', provider: null, frequency: null, senses: [],
    }).senses).toEqual([]);
  });

  it('reads the words behind the senses and what a sense is said with, and nothing of either from another provider', () => {
    const lookup = parseDiscoverLookup({
      entry: 'Kraft', sourceContext: null, language: 'DE', translationLanguage: 'UK', provider: 'lexicon', frequency: null,
      senses: [{
        index: 1, headword: 'Kraft', partOfSpeech: 'NOUN', transcription: null, translations: [], definition: 'körperliche Stärke', cefr: 'A2',
        examples: [], lexeme: 1, labels: {formality: 'formal', style: ['official'], figurative: true},
        regions: [{variety: 'de-AT', extent: 'mainly'}], grammar: {countability: 'Mass'}, frames: ['Kraft für etw. haben'],
        collocations: ['mit aller Kraft'], antonyms: ['Schwäche'], standardAlternative: null,
      }],
      lexemes: [{
        index: 1, lemma: 'Kraft', partOfSpeech: 'NOUN', kind: 'word', grammar: {gender: 'Fem', plural_class: '-¨e'},
        spellings: [{text: 'Kraft', varieties: ['de-DE'], pre_reform: true}],
        forms: [{form: 'Kräfte', features: {Case: 'Nom', Number: 'Plur', Person: 3}, varieties: [], senses: [1], reading: null, note: null}],
        relations: [{type: 'derived_from', lemma: 'kräftig', partOfSpeech: 'ADJ', senses: []}],
        components: [], separable: null,
      }],
    });
    expect(lookup.senses[0]).toEqual(jasmine.objectContaining({
      lexeme: 1,
      labels: {formality: 'formal', attitude: [], time: null, style: ['official'], normativity: null, domain: null, politeness: null, figurative: true, rare: false},
      regions: [{variety: 'de-AT', extent: 'mainly'}], grammar: {countability: 'Mass'}, frames: ['Kraft für etw. haben'],
      collocations: ['mit aller Kraft'], antonyms: ['Schwäche'], standardAlternative: null,
    }));
    expect(lookup.lexemes).toEqual([{
      index: 1, lemma: 'Kraft', partOfSpeech: 'NOUN', kind: 'word', grammar: {gender: 'Fem', plural_class: '-¨e'},
      spellings: [{text: 'Kraft', varieties: ['de-DE'], preReform: true}],
      forms: [{form: 'Kräfte', features: {Case: 'Nom', Number: 'Plur', Person: '3'}, varieties: [], senses: [1], reading: null, note: null}],
      relations: [{type: 'derived_from', lemma: 'kräftig', partOfSpeech: 'ADJ', senses: []}],
    }]);
    const plain = parseDiscoverLookup({
      entry: 'Ausgabe', sourceContext: null, language: 'DE', translationLanguage: 'EN', provider: 'dictionary', frequency: null,
      senses: [{index: 1, headword: 'die Ausgabe', partOfSpeech: 'noun', transcription: null, translations: ['edition']}],
    });
    expect(plain.lexemes).toEqual([]);
    expect(plain.senses[0]).toEqual(jasmine.objectContaining(NO_ENTRY));
  });

  it('reads the lexicon fields: pronunciations, definition, level and examples', () => {
    const lookup = parseDiscoverLookup({
      entry: 'colour', sourceContext: null, language: 'EN', translationLanguage: 'UK', provider: 'lexicon', frequency: null,
      pronunciations: [
        {variety: 'en-GB', ipa: 'ˈkʌlə', clipUrl: '/public/lexicon/clips/0b7c1b6e-9d8d-4c2a-9f1e-3a2d6c5b4a10', clipStatus: 'verified',
          segments: [{text: 'ˈkʌl', differs: false}, {text: 'ə', differs: true}], senses: [1]},
        {variety: 'en-US', ipa: 'ˈkʌlɚ', clipUrl: null, clipStatus: null, senses: [1]},
      ],
      senses: [{
        index: 1, headword: 'colour', partOfSpeech: 'noun', transcription: null, translations: ['колір'],
        definition: 'The property of an object that depends on the light it reflects.', cefr: 'A1',
        examples: [{text: 'What colour is it?', translation: 'Якого воно кольору?'}, {text: 'A splash of colour.', translation: null}],
      }],
    });
    expect(lookup.pronunciations).toEqual([
      {variety: 'en-GB', ipa: 'ˈkʌlə', clipUrl: '/public/lexicon/clips/0b7c1b6e-9d8d-4c2a-9f1e-3a2d6c5b4a10', clipStatus: 'verified',
        segments: [{text: 'ˈkʌl', differs: false}, {text: 'ə', differs: true}], senses: [1]},
      {variety: 'en-US', ipa: 'ˈkʌlɚ', clipUrl: null, clipStatus: null, segments: null, senses: [1]},
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
    expect(lookup.requestedLanguage).toBeNull();
    expect(lookup.availableLanguages).toEqual([]);
    expect(lookup.scriptMismatch).toBeFalse();
    expect(lookup.senses[0].definition).toBeNull();
    expect(lookup.senses[0].cefr).toBeNull();
    expect(lookup.senses[0].examples).toEqual([]);
  });

  it('reads cross-language redirect and script-mismatch fields when sent', () => {
    const lookup = parseDiscoverLookup({
      entry: 'word', sourceContext: null, language: 'EN', translationLanguage: 'UK', provider: 'lexicon', frequency: null,
      senses: [], requestedLanguage: 'FR', availableLanguages: ['DE'], scriptMismatch: true,
    });
    expect(lookup.requestedLanguage).toBe(LanguageCode.FR);
    expect(lookup.availableLanguages).toEqual([LanguageCode.DE]);
    expect(lookup.scriptMismatch).toBeTrue();
  });

  it('rejects a clip status outside the contract', () => {
    expect(() => parseDiscoverLookup({
      entry: 'colour', sourceContext: null, language: 'EN', translationLanguage: 'UK', provider: 'lexicon', frequency: null, senses: [],
      pronunciations: [{variety: 'en-GB', ipa: null, clipUrl: null, clipStatus: 'pending', senses: []}],
    })).toThrowError(/discoverLookup.pronunciations\[0\].clipStatus/);
  });

  it('still rejects a response missing the established fields', () => {
    expect(() => parseDiscoverLookup({entry: 'colour', language: 'EN', translationLanguage: 'UK', pronunciations: []}))
      .toThrowError(/discoverLookup.senses/);
  });
});
