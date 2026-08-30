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

  it('persists a learner CEFR level with the learner update endpoint', () => {
    service.updateLearner(LanguageCode.DE, {level: CEFRLevel.B2}).subscribe();

    const request = httpTesting.expectOne(`${AppConstants.LEARNER_PROFILES_URL}/${LanguageCode.DE}`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({level: CEFRLevel.B2});
    expect(request.request.withCredentials).toBeTrue();

    request.flush({
      id: 'learner-1',
      language: LanguageCode.DE,
      selfReportedLevel: CEFRLevel.B2,
      active: true,
    });
  });
});
