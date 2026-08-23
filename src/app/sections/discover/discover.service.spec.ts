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
});
