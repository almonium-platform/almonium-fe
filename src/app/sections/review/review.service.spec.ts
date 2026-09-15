import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {firstValueFrom} from 'rxjs';
import {AppConstants} from '../../app.constants';
import {LanguageCode} from '../../models/language.enum';
import {ReviewService} from './review.service';

describe('ReviewService', () => {
  let service: ReviewService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    service = TestBed.inject(ReviewService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the server-owned queue summary', async () => {
    const result = firstValueFrom(service.getSummary(LanguageCode.DE));
    const request = http.expectOne(`${AppConstants.REVIEW_URL}/summary/DE`);
    expect(request.request.withCredentials).toBeTrue();
    request.flush({dueCount: 14, sessionSize: 10, understandCount: 6, produceCount: 3, disambiguateCount: 1, leechCount: 0, leeches: []});
    expect((await result).sessionSize).toBe(10);
  });

  it('submits typed evidence and the opened hint ledger', async () => {
    const result = firstValueFrom(service.answer('01900000-0000-7000-8000-000000000001', '01900000-0000-7000-8000-000000000002', '01900000-0000-7000-8000-000000000003', 'die Ausgabe', ['GENDER'], false));
    const request = http.expectOne(`${AppConstants.REVIEW_URL}/sessions/01900000-0000-7000-8000-000000000001/items/01900000-0000-7000-8000-000000000002/answer`);
    expect(request.request.body).toEqual({promptId: '01900000-0000-7000-8000-000000000003', answer: 'die Ausgabe', hintsOpened: ['GENDER'], revealed: false});
    request.flush({eventId: '01900000-0000-7000-8000-000000000004', outcome: 'RECOVERED_WITH_HINT', answer: 'die Ausgabe', expectedAnswer: 'die Ausgabe', confusedWith: null, dueAt: '2026-08-24T10:00:00Z', leech: false, completedCount: 1, sessionSize: 10});
    expect((await result).outcome).toBe('RECOVERED_WITH_HINT');
  });
});
