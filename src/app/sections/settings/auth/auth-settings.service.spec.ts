import {HttpClient} from '@angular/common/http';
import {TestBed} from '@angular/core/testing';
import {Auth} from '@angular/fire/auth';
import {firstValueFrom} from 'rxjs';
import {LocalStorageService} from '../../../services/local-storage.service';
import {AuthSettingsService} from './auth-settings.service';

describe('AuthSettingsService provider cache', () => {
  let service: AuthSettingsService;
  let firebaseAuth: {
    currentUser: {
      email: string;
      metadata: {creationTime: string; lastSignInTime: string};
      providerData: {providerId: string; email: string}[];
    } | null;
    authStateReady: jasmine.Spy<() => Promise<void>>;
  };
  let storage: jasmine.SpyObj<LocalStorageService>;

  beforeEach(() => {
    firebaseAuth = {
      currentUser: null,
      authStateReady: jasmine.createSpy('authStateReady').and.resolveTo(),
    };
    storage = jasmine.createSpyObj<LocalStorageService>(
      'LocalStorageService',
      ['getAuthMethods', 'saveAuthMethods'],
    );

    TestBed.configureTestingModule({
      providers: [
        AuthSettingsService,
        {provide: HttpClient, useValue: jasmine.createSpyObj<HttpClient>('HttpClient', ['get'])},
        {provide: Auth, useValue: firebaseAuth},
        {provide: LocalStorageService, useValue: storage},
      ],
    });

    service = TestBed.inject(AuthSettingsService);
  });

  it('uses cached providers when the browser session outlives Firebase in-memory auth', async () => {
    const cachedMethods = [{
      provider: 'google',
      email: 'reader@example.com',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-07-01T00:00:00Z',
    }];
    storage.getAuthMethods.and.returnValue(cachedMethods);

    expect(await firstValueFrom(service.populateAuthMethods())).toEqual(cachedMethods);
    expect(storage.saveAuthMethods.calls.count()).toBe(0);
  });

  it('refreshes the cache when Firebase identity is available', async () => {
    firebaseAuth.currentUser = {
      email: 'reader@example.com',
      metadata: {
        creationTime: '2026-01-01T00:00:00Z',
        lastSignInTime: '2026-07-27T12:00:00Z',
      },
      providerData: [
        {providerId: 'google.com', email: 'reader@example.com'},
        {providerId: 'password', email: 'reader@example.com'},
      ],
    };

    const methods = await firstValueFrom(service.populateAuthMethods());

    expect(methods.map(method => method.provider)).toEqual(['google', 'local']);
    expect(storage.saveAuthMethods.calls.mostRecent().args[0]).toEqual(methods);
    expect(storage.getAuthMethods.calls.count()).toBe(0);
  });
});
