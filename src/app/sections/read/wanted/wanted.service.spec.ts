import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {firstValueFrom} from 'rxjs';
import {AppConstants} from '../../../app.constants';
import {LanguageCode} from '../../../models/language.enum';
import {WantedService} from './wanted.service';

describe('WantedService', () => {
  let service: WantedService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    service = TestBed.inject(WantedService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('wants a catalogue work in a language and reads its place in line', async () => {
    const receipt = firstValueFrom(service.want('w1', LanguageCode.FR));
    const request = http.expectOne(`${AppConstants.BOOKS_URL}/wants`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({catalogWorkId: 'w1', language: 'FR'});
    expect(request.request.withCredentials).toBeTrue();
    request.flush({catalogWorkId: 'w1', language: 'FR', rank: 2, readers: null}, {status: 201, statusText: 'Created'});
    expect((await receipt).rank).toBe(2);
  });

  it('withdraws by work and language', () => {
    service.withdraw('w1', LanguageCode.FR).subscribe();
    const request = http.expectOne(`${AppConstants.BOOKS_URL}/wants/w1/FR`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, {status: 204, statusText: 'No Content'});
  });

  it('loads everyone’s queue or only the reader’s', () => {
    service.queue().subscribe();
    service.queue(true).subscribe();
    const [everyone, mine] = http.match(req => req.url === `${AppConstants.BOOKS_URL}/wanted`);
    expect(everyone.request.params.get('mine')).toBe('false');
    expect(mine.request.params.get('mine')).toBe('true');
    const empty = {beingPrepared: [], queue: [], recentlyArrived: [], mineCount: 0};
    everyone.flush(empty);
    mine.flush(empty);
  });
});
