import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {AppConstants} from '../app.constants';
import {LanguageCode} from '../models/language.enum';
import {logger} from '../shared/logger';
import {localDate} from '../shared/rhythm/rhythm.model';
import {RhythmService} from '../shared/rhythm/rhythm.service';

export type ActivitySource = 'READ' | 'REVIEW' | 'PLAY';

const TICK_MS = 5_000;
const FLUSH_AFTER_SECONDS = 60;
/** A tab left open overnight is not a night of reading, so attention lapses stop the clock. */
const IDLE_TIMEOUT_MS = 120_000;
const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/**
 * Counts the time a learner actually spends learning and reports it to the harness.
 *
 * <p>The minutes are texture for the rhythm band's tint; what marks a day is that any learning happened at all, so
 * a report is worth sending even when the time on it is small.
 */
@Injectable({providedIn: 'root'})
export class LearningActivityService {
  private readonly http = inject(HttpClient);
  private readonly rhythmService = inject(RhythmService);

  private source: ActivitySource | null = null;
  private language: LanguageCode | null = null;
  private pendingSeconds = 0;
  private lastInteractionAt = 0;
  private lastReportedDate: string | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private readonly onInteraction = () => this.lastInteractionAt = Date.now();
  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      this.lastInteractionAt = Date.now();
    } else {
      this.flush(false);
    }
  };

  /**
   * Begins counting time in a learning surface, against one language. Safe to call again; a different surface or
   * language flushes the previous one first, so time is never credited to the wrong commitment.
   */
  start(source: ActivitySource, language: LanguageCode): void {
    if (this.source === source && this.language === language) return;
    if (this.source) this.flush(false);

    this.source = source;
    this.language = language;
    this.lastInteractionAt = Date.now();
    if (this.ticker) return;

    INTERACTION_EVENTS.forEach(event => document.addEventListener(event, this.onInteraction, {passive: true}));
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.ticker = setInterval(() => this.tick(), TICK_MS);
  }

  /** Stops counting and reports whatever was accumulated. Pass `completed` when a discrete event just finished. */
  stop(completed = false): void {
    this.flush(completed);
    this.source = null;
    this.language = null;
    if (!this.ticker) return;

    clearInterval(this.ticker);
    this.ticker = null;
    INTERACTION_EVENTS.forEach(event => document.removeEventListener(event, this.onInteraction));
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private tick(): void {
    const attentive = document.visibilityState === 'visible' && Date.now() - this.lastInteractionAt < IDLE_TIMEOUT_MS;
    if (!attentive || !this.source) return;

    this.pendingSeconds += TICK_MS / 1000;
    if (this.pendingSeconds >= FLUSH_AFTER_SECONDS) this.flush(false);
  }

  private flush(completed: boolean): void {
    const seconds = Math.round(this.pendingSeconds);
    if (!this.source || !this.language || (seconds === 0 && !completed)) return;

    const today = localDate();
    // The day flips to met on its first report; later reports only deepen a tint nobody is watching live.
    const marksTheDay = this.lastReportedDate !== today;
    this.pendingSeconds = 0;
    this.lastReportedDate = today;

    this.http.post<void>(
      `${AppConstants.LEARNING_URL}/activity`,
      {source: this.source, language: this.language, seconds, localDate: today, completed},
      {withCredentials: true},
    ).subscribe({
      next: () => {
        if (marksTheDay) this.rhythmService.load().subscribe({error: () => undefined});
      },
      error: error => logger.error('Could not record learning activity', error),
    });
  }
}
