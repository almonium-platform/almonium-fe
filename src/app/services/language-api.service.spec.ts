import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting, HttpTestingController} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {AppConstants} from '../app.constants';
import {LanguageCode} from '../models/language.enum';
import {CEFRLevel} from '../models/userinfo.model';
import {LanguageApiService} from './language-api.service';

describe('LanguageApiService', () => {
  let service: LanguageApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(LanguageApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('requests all voices or one language with session credentials', () => {
    service.getVoices().subscribe();
    const all = httpTesting.expectOne(`${AppConstants.API_URL}/lang/voices`);
    expect(all.request.withCredentials).toBeTrue();
    all.flush([]);

    let result: unknown;
    service.getVoices(LanguageCode.DE).subscribe(value => result = value);
    const german = httpTesting.expectOne(`${AppConstants.API_URL}/lang/voices/DE`);
    expect(german.request.method).toBe('GET');
    expect(german.request.withCredentials).toBeTrue();
    const unavailable = {language: 'DE', variety: 'de-CH', defaultVariety: false,
      available: false, unavailableReason: 'NO_ENABLED_VOICE', provider: null,
      languageCode: null, voiceId: null, gender: null};
    german.flush([unavailable]);
    expect(result).toEqual([unavailable]);
  });

  it('accepts the learner update endpoint returning no content', () => {
    let result: unknown = 'not emitted';
    service.updateLearner(LanguageCode.DE, {level: CEFRLevel.B2}).subscribe((learner) => result = learner);

    const request = httpTesting.expectOne(`${AppConstants.LEARNER_PROFILES_URL}/${LanguageCode.DE}`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({level: CEFRLevel.B2});
    expect(request.request.withCredentials).toBeTrue();

    request.flush(null, {status: 204, statusText: 'No Content'});

    expect(result).toBeNull();
  });
});
