import {HttpErrorResponse} from '@angular/common/http';
import {TestBed} from '@angular/core/testing';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {of, throwError} from 'rxjs';
import {AuthSettingsService} from '../../sections/settings/auth/auth-settings.service';
import {AppHttpError} from '../../shared/app-http-error';
import {RecentAuthGuardStateService} from '../../shared/recent-auth-guard/recent-auth-guard-state.service';
import {LocalStorageService} from '../../services/local-storage.service';
import {RecentAuthGuardService} from './recent-auth-guard.service';

describe('RecentAuthGuardService', () => {
  let service: RecentAuthGuardService;
  let settings: jasmine.SpyObj<AuthSettingsService>;
  let notifications: jasmine.SpyObj<TuiNotificationService>;
  let storage: jasmine.SpyObj<LocalStorageService>;
  let state: jasmine.SpyObj<RecentAuthGuardStateService>;

  beforeEach(() => {
    settings = jasmine.createSpyObj<AuthSettingsService>('AuthSettingsService', ['checkCurrentAccessTokenIsLive']);
    notifications = jasmine.createSpyObj<TuiNotificationService>('TuiNotificationService', ['open']);
    notifications.open.and.returnValue(of(undefined));
    storage = jasmine.createSpyObj<LocalStorageService>('LocalStorageService', ['getItem', 'saveItem', 'removeItem']);
    storage.getItem.and.returnValue(null);
    state = jasmine.createSpyObj<RecentAuthGuardStateService>('RecentAuthGuardStateService', ['open']);

    TestBed.configureTestingModule({
      providers: [
        RecentAuthGuardService,
        {provide: AuthSettingsService, useValue: settings},
        {provide: TuiNotificationService, useValue: notifications},
        {provide: LocalStorageService, useValue: storage},
        {provide: RecentAuthGuardStateService, useValue: state},
      ],
    });

    service = TestBed.inject(RecentAuthGuardService);
  });

  it('opens reauthentication instead of exposing a stale-login API error', () => {
    settings.checkCurrentAccessTokenIsLive.and.returnValue(throwError(() => recentLoginRequired()));
    const action = jasmine.createSpy('action');

    service.guardAction(action);

    expect(state.open.calls.count()).toBe(1);
    expect(action).not.toHaveBeenCalled();
    expect(notifications.open.calls.count()).toBe(0);
  });

  it('resumes the pending action once after successful reauthentication', () => {
    settings.checkCurrentAccessTokenIsLive.and.returnValues(
      throwError(() => recentLoginRequired()),
      of('2026-07-27T12:05:00Z'),
    );
    const action = jasmine.createSpy('action');

    service.guardAction(action);
    service.updateStatusAndShowAlert();

    expect(action).toHaveBeenCalledTimes(1);
    expect(storage.saveItem.calls.allArgs()).toContain([
      'recent_login_cache_timestamp',
      new Date('2026-07-27T12:05:00Z').getTime(),
    ]);
  });

  it('forces the modal when Firebase in-memory auth is missing despite a recent session cache', () => {
    storage.getItem.and.returnValue(Date.now() + 60_000);
    const action = jasmine.createSpy('action');

    service.guardAction(action, true);

    expect(state.open.calls.count()).toBe(1);
    expect(settings.checkCurrentAccessTokenIsLive.calls.count()).toBe(0);
    expect(action).not.toHaveBeenCalled();
    expect(storage.removeItem.calls.allArgs()).toContain(['recent_login_cache_timestamp']);
  });

  it('passes the protected action name to the verification card', () => {
    settings.checkCurrentAccessTokenIsLive.and.returnValue(throwError(() => recentLoginRequired()));

    service.guardAction(() => undefined, false, 'Delete account');

    expect(state.open.calls.allArgs()).toEqual([['Delete account']]);
  });

  it('keeps unexpected access-token failures as errors', () => {
    settings.checkCurrentAccessTokenIsLive.and.returnValues(
      throwError(() => new Error('Network unavailable')),
      of('2026-07-27T12:05:00Z'),
    );
    const action = jasmine.createSpy('action');

    service.guardAction(action);
    service.updateStatusAndShowAlert();

    expect(state.open.calls.count()).toBe(0);
    expect(action).not.toHaveBeenCalled();
    expect(notifications.open.calls.allArgs()).toContain(['Network unavailable', {appearance: 'negative'}]);
  });

  function recentLoginRequired(): AppHttpError {
    return new AppHttpError(new HttpErrorResponse({
      status: 403,
      statusText: 'Forbidden',
      error: {success: false, message: 'User must have signed in with Firebase within the last 5 minutes.'},
    }));
  }
});
