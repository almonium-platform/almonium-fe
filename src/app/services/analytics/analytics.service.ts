import {DestroyRef, inject, Injectable, InjectionToken} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {distinctUntilChanged, map} from 'rxjs';
import type {PostHog, PostHogConfig} from 'posthog-js';
import {environment} from '../../../environments/environment';
import {UserInfoService} from '../user-info.service';
import {logger} from '../../shared/logger';

/** Every product event the app sends; PostHog never sees a name outside this list. */
export type AnalyticsEvent =
  | 'signup'
  | 'first_lookup'
  | 'first_save'
  | 'review_session_completed'
  | 'book_opened'
  | 'book_progress'
  | 'share_link_created'
  | 'share_link_opened'
  | 'subscribe_started';

export type AnalyticsProperties = Record<string, string | number | boolean | null>;

export interface AnalyticsConfig {
  /** The PostHog project key; empty turns every call into a no-op. */
  key: string;
  host: string;
}

export const ANALYTICS_CONFIG = new InjectionToken<AnalyticsConfig>('ANALYTICS_CONFIG', {
  providedIn: 'root',
  factory: () => environment.posthog,
});

/** Loads the PostHog client; only ever called when a key is set, so the bundle stays out otherwise. */
export const POSTHOG_LOADER = new InjectionToken<() => Promise<PostHog>>('POSTHOG_LOADER', {
  providedIn: 'root',
  factory: () => () => import('posthog-js').then(module => module.default),
});

/** The web client; the mobile app sends `ios` or `android` under the same property. */
export const ANALYTICS_PLATFORM = 'web';

/** Book progress milestones, in percent, each sent once per book on this device. */
export const BOOK_PROGRESS_MILESTONES = [25, 50, 75, 100] as const;

const FIRST_EVENT_KEY_PREFIX = 'analytics.first.';
const BOOK_MILESTONE_KEY_PREFIX = 'analytics.bookProgress.';

/**
 * The one place the app talks to PostHog. Without a key (local dev, tests) nothing loads and
 * every method returns quietly. The user is identified by the internal id only.
 */
@Injectable({providedIn: 'root'})
export class AnalyticsService {
  private readonly config = inject(ANALYTICS_CONFIG);
  private readonly loadPostHog = inject(POSTHOG_LOADER);
  private readonly userInfoService = inject(UserInfoService);
  private readonly destroyRef = inject(DestroyRef);

  private client: Promise<PostHog | null> = Promise.resolve(null);
  private userId: string | null = null;
  private started = false;

  get enabled(): boolean {
    return !!this.config.key;
  }

  init(): void {
    if (this.started || !this.enabled) return;
    this.started = true;
    this.client = this.loadPostHog().then(posthog => {
      posthog.init(this.config.key, this.clientConfig());
      posthog.register({platform: ANALYTICS_PLATFORM});
      return posthog;
    }).catch((error: unknown) => {
      logger.warn('Analytics could not load; continuing without it.', error);
      return null;
    });

    this.userInfoService.userInfo$.pipe(
      map(user => user?.id ?? null),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(id => {
      const previous = this.userId;
      this.userId = id;
      if (id) this.withClient(posthog => posthog.identify(id));
      else if (previous) this.withClient(posthog => {
        posthog.reset();
        // reset() drops super properties too.
        posthog.register({platform: ANALYTICS_PLATFORM});
      });
    });
  }

  track(event: AnalyticsEvent, properties: AnalyticsProperties = {}): void {
    this.withClient(posthog => posthog.capture(event, properties));
  }

  /** Sends the event the first time this user (or a guest) does the thing on this device. */
  trackFirst(event: Extract<AnalyticsEvent, 'first_lookup' | 'first_save'>, properties: AnalyticsProperties = {}): void {
    if (!this.enabled) return;
    const key = `${FIRST_EVENT_KEY_PREFIX}${event}.${this.userId ?? 'guest'}`;
    if (readStorage(key)) return;
    writeStorage(key, '1');
    this.track(event, properties);
  }

  /** Sends `book_progress` for each milestone newly reached; earlier ones are remembered per book. */
  trackBookProgress(bookId: string, percentage: number): void {
    if (!this.enabled) return;
    const key = `${BOOK_MILESTONE_KEY_PREFIX}${bookId}`;
    const reached = Number(readStorage(key) ?? 0);
    const newlyReached = BOOK_PROGRESS_MILESTONES.filter(milestone => milestone > reached && percentage >= milestone);
    if (!newlyReached.length) return;
    writeStorage(key, String(newlyReached[newlyReached.length - 1]));
    newlyReached.forEach(milestone => this.track('book_progress', {book_id: bookId, milestone}));
  }

  private clientConfig(): Partial<PostHogConfig> {
    return {
      api_host: this.config.host,
      person_profiles: 'identified_only',
      capture_pageview: 'history_change',
      capture_pageleave: true,
      // Clicks would carry element text; the events above are the whole product signal.
      autocapture: false,
      disable_session_recording: true,
      mask_all_text: false,
      session_recording: {maskAllInputs: true},
    };
  }

  private withClient(action: (posthog: PostHog) => void): void {
    if (!this.enabled) return;
    void this.client.then(posthog => {
      if (!posthog) return;
      try {
        action(posthog);
      } catch (error) {
        logger.warn('Analytics call failed.', error);
      }
    });
  }
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode: the event may repeat, which is acceptable.
  }
}
