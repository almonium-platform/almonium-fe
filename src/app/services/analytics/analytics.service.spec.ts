import {TestBed} from '@angular/core/testing';
import {BehaviorSubject} from 'rxjs';
import type {PostHog} from 'posthog-js';
import {ANALYTICS_CONFIG, AnalyticsService, POSTHOG_LOADER} from './analytics.service';
import {UserInfoService} from '../user-info.service';
import {UserInfo} from '../../models/userinfo.model';

const flush = () => new Promise(resolve => setTimeout(resolve));

describe('AnalyticsService', () => {
  let user$: BehaviorSubject<UserInfo | null>;
  let loader: jasmine.Spy<() => Promise<PostHog>>;
  let posthog: Record<'init' | 'register' | 'identify' | 'reset' | 'capture', jasmine.Spy>;

  function setUp(key: string): AnalyticsService {
    TestBed.configureTestingModule({
      providers: [
        {provide: ANALYTICS_CONFIG, useValue: {key, host: 'https://eu.i.posthog.com'}},
        {provide: POSTHOG_LOADER, useValue: loader},
        {provide: UserInfoService, useValue: {userInfo$: user$.asObservable()}},
      ],
    });
    return TestBed.inject(AnalyticsService);
  }

  beforeEach(() => {
    localStorage.clear();
    user$ = new BehaviorSubject<UserInfo | null>(null);
    posthog = {
      init: jasmine.createSpy('init'),
      register: jasmine.createSpy('register'),
      identify: jasmine.createSpy('identify'),
      reset: jasmine.createSpy('reset'),
      capture: jasmine.createSpy('capture'),
    };
    loader = jasmine.createSpy('loader').and.callFake(() => Promise.resolve(posthog as unknown as PostHog));
  });

  afterEach(() => localStorage.clear());

  describe('without a key', () => {
    it('never loads PostHog and every call is a silent no-op', async () => {
      const analytics = setUp('');

      expect(analytics.enabled).toBeFalse();
      expect(() => {
        analytics.init();
        user$.next({id: 'user-1'} as UserInfo);
        user$.next(null);
        analytics.track('signup', {method: 'password'});
        analytics.trackFirst('first_lookup', {language: 'DE'});
        analytics.trackBookProgress('book-1', 80);
      }).not.toThrow();
      await flush();

      expect(loader).not.toHaveBeenCalled();
      expect(posthog.capture).not.toHaveBeenCalled();
      expect(localStorage.length).toBe(0);
    });
  });

  describe('with a key', () => {
    it('sets up a private client tagged with the web platform', async () => {
      setUp('phc_test').init();
      await flush();

      expect(loader).toHaveBeenCalledTimes(1);
      const [key, config] = posthog.init.calls.mostRecent().args as [string, object];
      expect(key).toBe('phc_test');
      expect(config).toEqual(jasmine.objectContaining({
        api_host: 'https://eu.i.posthog.com',
        autocapture: false,
        disable_session_recording: true,
        session_recording: {maskAllInputs: true},
      }));
      expect(posthog.register).toHaveBeenCalledWith({platform: 'web'});
    });

    it('identifies by the internal id only and resets on logout', async () => {
      setUp('phc_test').init();
      user$.next({id: 'user-1', email: 'a@b.c'} as UserInfo);
      await flush();
      expect(posthog.identify).toHaveBeenCalledOnceWith('user-1');

      user$.next(null);
      await flush();
      expect(posthog.reset).toHaveBeenCalledTimes(1);
      expect(posthog.register).toHaveBeenCalledTimes(2);
    });

    it('sends a first event once and each book milestone once', async () => {
      const analytics = setUp('phc_test');
      analytics.init();
      analytics.trackFirst('first_save');
      analytics.trackFirst('first_save');
      analytics.trackBookProgress('book-1', 60);
      analytics.trackBookProgress('book-1', 60);
      analytics.trackBookProgress('book-1', 100);
      await flush();

      const sent = (posthog.capture.calls.allArgs() as [string, Record<string, unknown>?][])
        .map(([event, props]): [string, unknown] => [event, props?.['milestone']]);
      expect(sent).toEqual([
        ['first_save', undefined],
        ['book_progress', 25],
        ['book_progress', 50],
        ['book_progress', 75],
        ['book_progress', 100],
      ]);
    });
  });
});
