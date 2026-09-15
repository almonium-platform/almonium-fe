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
