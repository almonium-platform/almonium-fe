import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting, HttpTestingController} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {firstValueFrom} from 'rxjs';
import {
  DEFAULT_UI_PREFERENCES,
  PlanType,
  SetupStep,
  UserInfoData,
  UserInfoDto,
} from '../models/userinfo.model';
import {LanguageCode} from '../models/language.enum';
import {AppConstants} from '../app.constants';
import {LocalStorageService} from './local-storage.service';
import {UserInfoService} from './user-info.service';

describe('UserInfoService', () => {
  let service: UserInfoService;
  let httpTesting: HttpTestingController;
  let localStorage: jasmine.SpyObj<LocalStorageService>;

  const cachedUser: UserInfoData = {
    id: 'user-1',
    username: 'cached',
    email: 'cached@example.com',
    emailVerified: true,
    hidden: false,
    uiLang: 'en',
    avatarUrl: null,
    background: null,
    streak: 1,
    fluentLangs: [],
    setupStep: SetupStep.COMPLETED,
    tags: [],
    subscription: {
      name: 'Free',
      limits: {MAX_FLUENT_LANGS: 1},
      type: PlanType.MONTHLY,
      autoRenewal: null,
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2027-01-01T00:00:00Z',
    },
    premium: false,
    admin: false,
    learners: [],
    interests: [],
    uiPreferences: DEFAULT_UI_PREFERENCES,
  };

  const serverUser: UserInfoDto = {
    ...cachedUser,
    username: 'authoritative',
    streamChatToken: 'secret-stream-token',
  };

  beforeEach(() => {
    localStorage = jasmine.createSpyObj<LocalStorageService>(
      'LocalStorageService',
      ['getUserInfo', 'saveUserInfo', 'clearUserInfo'],
    );
    localStorage.getUserInfo.and.returnValue(cachedUser);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {provide: LocalStorageService, useValue: localStorage},
      ],
    });

    service = TestBed.inject(UserInfoService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('does not treat cached user data as an authenticated session', async () => {
    expect(service.currentUserInfo).toBeNull();

    const resultPromise = firstValueFrom(service.loadUserInfo());
    const request = httpTesting.expectOne(AppConstants.ME_URL);
    request.flush(serverUser);

    expect((await resultPromise)?.username).toBe('authoritative');
  });

  it('clears cached identity after an authoritative session rejection', async () => {
    const resultPromise = firstValueFrom(service.loadUserInfo());
    const request = httpTesting.expectOne(AppConstants.ME_URL);
    request.flush({}, {status: 401, statusText: 'Unauthorized'});

    expect(await resultPromise).toBeNull();
    expect(service.currentUserInfo).toBeNull();
    expect(localStorage.clearUserInfo.calls.count()).toBe(1);
  });

  it('keeps the Stream token in memory and out of persisted user info', async () => {
    const resultPromise = firstValueFrom(service.fetchUserInfoFromServer());
    httpTesting.expectOne(AppConstants.ME_URL).flush(serverUser);
    await resultPromise;

    expect(service.streamChatToken).toBe('secret-stream-token');
    const persistedUser = localStorage.saveUserInfo.calls.mostRecent().args[0];
    expect(Object.hasOwn(persistedUser, 'streamChatToken')).toBeFalse();
  });

  it('does not let an older profile refresh overwrite a newer one', async () => {
    const olderRequestPromise = firstValueFrom(service.fetchUserInfoFromServer());
    const newerRequestPromise = firstValueFrom(service.fetchUserInfoFromServer());
    const [olderRequest, newerRequest] = httpTesting.match(AppConstants.ME_URL);

    newerRequest.flush({...serverUser, username: 'new-level'});
    olderRequest.flush({...serverUser, username: 'old-level'});

    await Promise.all([olderRequestPromise, newerRequestPromise]);

    expect(service.currentUserInfo?.username).toBe('new-level');
    expect(localStorage.saveUserInfo.calls.mostRecent().args[0].username).toBe('new-level');
  });

  it('rejects malformed session DTOs without persisting partial identity state', async () => {
    const resultPromise = firstValueFrom(service.fetchUserInfoFromServer());
    httpTesting.expectOne(AppConstants.ME_URL).flush({
      ...serverUser,
      learners: 'not-an-array',
    });

    expect(await resultPromise).toBeNull();
    expect(service.currentUserInfo).toBeNull();
    expect(localStorage.saveUserInfo.calls.count()).toBe(0);
  });

  it('accepts a null end date for lifetime subscriptions', async () => {
    const resultPromise = firstValueFrom(service.fetchUserInfoFromServer());
    httpTesting.expectOne(AppConstants.ME_URL).flush({
      ...serverUser,
      subscription: {
        ...serverUser.subscription,
        type: PlanType.LIFETIME,
        endDate: null,
      },
    });

    expect((await resultPromise)?.subscription.endDate).toBeNull();
  });

  it('uses the fluent-language limit supplied by the subscription', async () => {
    const resultPromise = firstValueFrom(service.fetchUserInfoFromServer());
    httpTesting.expectOne(AppConstants.ME_URL).flush(serverUser);

    expect((await resultPromise)?.subscription.getMaxFluentLanguages()).toBe(1);
  });

  it('updates the cached and in-memory fluent languages together', async () => {
    const resultPromise = firstValueFrom(service.fetchUserInfoFromServer());
    httpTesting.expectOne(AppConstants.ME_URL).flush(serverUser);
    await resultPromise;

    service.updateUserInfo({fluentLangs: [LanguageCode.DE]});

    expect(service.currentUserInfo?.fluentLangs).toEqual([LanguageCode.DE]);
    expect(localStorage.saveUserInfo.calls.mostRecent().args[0].fluentLangs).toEqual([LanguageCode.DE]);
  });

  it('keeps an explicit null when resetting the avatar', async () => {
    const resultPromise = firstValueFrom(service.fetchUserInfoFromServer());
    httpTesting.expectOne(AppConstants.ME_URL).flush({
      ...serverUser,
      avatarUrl: 'https://example.test/assets/img/avatars/default/stag.png',
    });
    await resultPromise;

    service.updateUserInfo({avatarUrl: null});

    expect(service.currentUserInfo?.avatarUrl).toBeNull();
    expect(localStorage.saveUserInfo.calls.mostRecent().args[0].avatarUrl).toBeNull();
  });

  it('normalizes partial UI preferences with safe defaults', async () => {
    const resultPromise = firstValueFrom(service.fetchUserInfoFromServer());
    httpTesting.expectOne(AppConstants.ME_URL).flush({
      ...serverUser,
      uiPreferences: {
        navbar: {read: false},
      },
    });

    const user = await resultPromise;
    expect(user?.uiPreferences.navbar.read).toBeFalse();
    expect(user?.uiPreferences.navbar.discover).toBeTrue();
    expect(user?.uiPreferences.profileMenu.billing).toBeFalse();
  });
});
