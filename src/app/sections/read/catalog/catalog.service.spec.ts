import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {firstValueFrom} from 'rxjs';
import {AppConstants} from '../../../app.constants';
import {CatalogService} from './catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    service = TestBed.inject(CatalogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('searches the public catalogue for twenty hits by default', async () => {
    const result = firstValueFrom(service.search('dracula'));
    const request = http.expectOne(req => req.url === `${AppConstants.PUBLIC_URL}/catalog/search`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('q')).toBe('dracula');
    expect(request.request.params.get('limit')).toBe('20');
    request.flush([{id: 'a', title: 'Dracula', author: 'Bram Stoker', year: 1897, state: 'WANTABLE', freeFrom: 1983}]);
    expect((await result)[0].state).toBe('WANTABLE');
  });
});
