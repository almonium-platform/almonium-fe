import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {AppConstants} from '../app.constants';
import {OpsService} from './ops.service';

describe('OpsService', () => {
  let service: OpsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    service = TestBed.inject(OpsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('deletes a user account with the session cookie', () => {
    service.deleteUser('u1').subscribe();
    const request = http.expectOne(`${AppConstants.OPS_URL}/users/u1`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.withCredentials).toBeTrue();
    request.flush({});
  });
});
