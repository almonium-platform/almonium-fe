import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {AppConstants} from '../app.constants';
import {OpsDemandService, demandWorkMeta, sourceBlockedReason, sourceTranslationLine} from './ops-demand.service';

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
    const bare = http.expectOne(`${AppConstants.OPS_URL}/demand/wanted/c1/FR/start`);
    expect(bare.request.method).toBe('POST');
    expect(bare.request.body).toEqual({});
    service.start(row, 's1').subscribe();
    expect(http.expectOne(`${AppConstants.OPS_URL}/demand/wanted/c1/FR/start`).request.body).toEqual({sourceId: 's1'});
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

  it('lists a work’s text sources from the catalogue', () => {
    service.sources('c1').subscribe();
    const request = http.expectOne(`${AppConstants.OPS_URL}/catalog/works/c1/sources`);
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBeTrue();
    request.flush([]);
  });

  it('says who translated a source, or that it is the original', () => {
    expect(sourceTranslationLine({translation: false, translators: []})).toBe('original');
    expect(sourceTranslationLine({translation: true, translators: []})).toBe('translator unknown');
    expect(sourceTranslationLine({translation: true, translators: [
      {name: 'Constance Garnett', birthYear: 1861, deathYear: 1946},
      {name: 'Anon', birthYear: null, deathYear: null},
    ]})).toBe('translation by Constance Garnett (d. 1946), Anon (dates unknown)');
  });

  it('blocks only a protected source, with the date when known', () => {
    expect(sourceBlockedReason({status: 'FREE', freeFrom: 1990})).toBeNull();
    expect(sourceBlockedReason({status: 'UNKNOWN', freeFrom: null})).toBeNull();
    expect(sourceBlockedReason({status: 'PROTECTED', freeFrom: 2047})).toBe('Under copyright where we make books until 1 January 2047.');
    expect(sourceBlockedReason({status: 'PROTECTED', freeFrom: null})).toBe('Under copyright where we make books.');
  });
});
