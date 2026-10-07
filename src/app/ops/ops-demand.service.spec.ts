import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {AppConstants} from '../app.constants';
import {OpsDemandService, demandWorkMeta} from './ops-demand.service';

describe('OpsDemandService', () => {
  let service: OpsDemandService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    service = TestBed.inject(OpsDemandService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads demand over a window of days', () => {
    service.demand(7).subscribe();
    const request = http.expectOne(req => req.url === `${AppConstants.OPS_URL}/demand`);
    expect(request.request.params.get('days')).toBe('7');
    expect(request.request.withCredentials).toBeTrue();
    request.flush({days: 7, wanted: [], underCopyright: [], noMatch: []});
  });

  it('starts, declines and aliases where ops expects them', () => {
    const row = {catalogWorkId: 'c1', language: 'FR'};
    service.start(row).subscribe();
    expect(http.expectOne(`${AppConstants.OPS_URL}/demand/wanted/c1/FR/start`).request.method).toBe('POST');
    service.decline(row).subscribe();
    expect(http.expectOne(`${AppConstants.OPS_URL}/demand/wanted/c1/FR/decline`).request.method).toBe('POST');
    service.alias('drakula', 'c1').subscribe();
    const alias = http.expectOne(`${AppConstants.OPS_URL}/demand/aliases`);
    expect(alias.request.body).toEqual({query: 'drakula', catalogWorkId: 'c1'});
  });

  it('names the work by author and year, whichever is known', () => {
    expect(demandWorkMeta({author: 'Bram Stoker', year: 1897})).toBe('Bram Stoker · 1897');
    expect(demandWorkMeta({author: null, year: 1897})).toBe('1897');
    expect(demandWorkMeta({author: null, year: null})).toBe('Unknown author');
  });
});
