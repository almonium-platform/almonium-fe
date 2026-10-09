import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {AppConstants} from '../app.constants';
import {OpsRightsService, WorkRightsRow, authorLife, countryEntries, sortWorkRights, takedownCountry} from './ops-rights.service';

describe('OpsRightsService', () => {
  let service: OpsRightsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    service = TestBed.inject(OpsRightsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('takes a work down with one override, answering the report it came from', () => {
    service.addOverride({workSlug: 'lolita', country: '*', effect: 'BLOCK', reason: 'Estate asked', reportId: 'r1'}).subscribe();
    const request = http.expectOne(`${AppConstants.OPS_URL}/rights/overrides`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({workSlug: 'lolita', country: '*', effect: 'BLOCK', reason: 'Estate asked', reportId: 'r1'});
    expect(request.request.withCredentials).toBeTrue();
    request.flush({});
  });

  it('links a shelf work to a catalogue work and starts an import where ops expects them', () => {
    service.linkCatalogWork('the-great-gatsby', 'c1').subscribe();
    const link = http.expectOne(`${AppConstants.OPS_URL}/rights/works/the-great-gatsby/catalog`);
    expect(link.request.method).toBe('PUT');
    expect(link.request.body).toEqual({catalogWorkId: 'c1'});
    link.flush({});
    service.startCatalogImport().subscribe();
    expect(http.expectOne(`${AppConstants.OPS_URL}/catalog/import`).request.method).toBe('POST');
    service.removeOverride('o1').subscribe();
    expect(http.expectOne(`${AppConstants.OPS_URL}/rights/overrides/o1`).request.method).toBe('DELETE');
    service.dismissReport('r1').subscribe();
    expect(http.expectOne(`${AppConstants.OPS_URL}/rights/reports/r1/dismiss`).request.method).toBe('POST');
  });
});

describe('ops rights helpers', () => {
  const work = (title: string, blockedEverywhere: boolean, linked: boolean): WorkRightsRow => ({
    workSlug: title.toLowerCase(), title, author: 'A', linked, productionStatus: 'FREE', blockedEverywhere, blockedCountries: 0, overrides: 0,
  });

  it('puts works blocked everywhere first, then the unlinked, then by title', () => {
    const sorted = sortWorkRights([work('Emma', false, true), work('Dracula', false, false), work('Ulysses', true, true), work('Beowulf', false, true)]);
    expect(sorted.map(row => row.title)).toEqual(['Ulysses', 'Dracula', 'Beowulf', 'Emma']);
  });

  it('takes a report down in its country, or everywhere when it named none', () => {
    expect(takedownCountry({country: 'us'})).toBe('US');
    expect(takedownCountry({country: ''})).toBe('*');
    expect(takedownCountry({country: null})).toBe('*');
  });

  it('writes an author life the way the engine read it', () => {
    const base = {name: 'X', wikidataId: null, diedForFrance: false, rehabilitatedYear: null};
    expect(authorLife({...base, birthYear: 1880, deathYear: 1918, diedForFrance: true})).toBe('1880–1918 · mort pour la France');
    expect(authorLife({...base, birthYear: 1891, deathYear: null})).toBe('b. 1891');
    expect(authorLife({...base, birthYear: null, deathYear: 1938, rehabilitatedYear: 1956})).toBe('d. 1938 · rehabilitated 1956');
    expect(authorLife({...base, birthYear: null, deathYear: null})).toBe('dates unknown');
  });

  it('lists countries with everywhere first', () => {
    expect(countryEntries({US: 'ENGINE', '*': 'OVERRIDE', DE: 'ENGINE'}).map(row => row.country)).toEqual(['*', 'DE', 'US']);
  });
});
