import {Component, OnDestroy, OnInit, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {Subject, takeUntil} from 'rxjs';
import {LanguageCode} from '../../models/language.enum';
import {LanguageNameService} from '../../services/language-name.service';
import {LearningActivityService} from '../../services/learning-activity.service';
import {TargetLanguageDropdownService} from '../../services/target-language-dropdown.service';
import {getErrorMessage} from '../../shared/http-error';
import {LearningIntent, ReviewAnswer, ReviewItem, ReviewSession, ReviewSessionResult, ReviewSummary} from './review.model';
import {ReviewService} from './review.service';

type ReviewStage = 'overview' | 'session' | 'complete';

@Component({
  selector: 'app-review',
  templateUrl: './review.component.html',
  styleUrls: ['./review.component.less'],
  imports: [FormsModule, RouterLink],
})
export class ReviewComponent implements OnInit, OnDestroy {
  private readonly reviewService = inject(ReviewService);
  private readonly languageService = inject(TargetLanguageDropdownService);
  private readonly languageNameService = inject(LanguageNameService);
  private readonly learningActivity = inject(LearningActivityService);
  private readonly destroy$ = new Subject<void>();

  protected selectedLanguage = LanguageCode.EN;
  protected displayLanguageName = '';
  protected summary: ReviewSummary | null = null;
  protected session: ReviewSession | null = null;
  protected result: ReviewSessionResult | null = null;
  protected stage: ReviewStage = 'overview';
  protected currentIndex = 0;
  protected answerText = '';
  protected feedback: ReviewAnswer | null = null;
  protected openedHints = new Set<string>();
  protected loading = true;
  protected submitting = false;
  protected loadError = '';
  protected mistypeRecorded = false;

  ngOnInit(): void {
    this.languageService.currentLanguage$.pipe(takeUntil(this.destroy$)).subscribe(language => {
      this.selectedLanguage = language;
      this.displayLanguageName = this.languageNameService.getLanguageName(language);
      this.resetAndLoad();
    });
  }

  ngOnDestroy(): void {
    this.learningActivity.stop();
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected get currentItem(): ReviewItem | null {
    return this.session?.items[this.currentIndex] ?? null;
  }

  protected startSession(): void {
    if (this.submitting || !this.summary?.sessionSize) return;
    this.submitting = true;
    this.loadError = '';
    this.reviewService.startSession(this.selectedLanguage).pipe(takeUntil(this.destroy$)).subscribe({
      next: session => {
        this.session = session;
        this.currentIndex = 0;
        this.stage = session.items.length ? 'session' : 'overview';
        this.submitting = false;
        if (session.items.length) this.learningActivity.start('REVIEW');
      },
      error: error => {
        this.submitting = false;
        this.loadError = getErrorMessage(error, 'Could not start your review session. Please try again.');
      },
    });
  }

  protected toggleHint(type: string): void {
    if (this.feedback) return;
    if (this.openedHints.has(type)) {
      this.openedHints.delete(type);
    } else {
      this.openedHints.add(type);
    }
    this.openedHints = new Set(this.openedHints);
  }

  protected submitAnswer(revealed = false): void {
    const item = this.currentItem;
    if (!item || !this.session || this.feedback || this.submitting || (!revealed && !this.answerText.trim())) return;
    this.submitting = true;
    this.loadError = '';
    this.reviewService.answer(
      this.session.sessionId,
      item.itemId,
      item.promptId,
      this.answerText.trim(),
      [...this.openedHints],
      revealed,
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: feedback => {
        this.feedback = feedback;
        this.submitting = false;
      },
      error: error => {
        this.submitting = false;
        this.loadError = getErrorMessage(error, 'Your answer could not be recorded. Please try again.');
      },
    });
  }

  protected nextItem(): void {
    if (!this.session || !this.feedback) return;
    if (this.currentIndex < this.session.items.length - 1) {
      this.currentIndex++;
      this.answerText = '';
      this.feedback = null;
      this.openedHints.clear();
      this.mistypeRecorded = false;
      this.loadError = '';
      return;
    }
    this.finishSession();
  }

  protected markMistype(): void {
    if (!this.feedback?.confusedWith || this.mistypeRecorded || this.submitting) return;
    this.submitting = true;
    this.reviewService.markMistype(this.feedback.eventId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.mistypeRecorded = true;
        this.submitting = false;
      },
      error: error => {
        this.submitting = false;
        this.loadError = getErrorMessage(error, 'Could not record the mistype correction.');
      },
    });
  }

  protected leaveSession(): void {
    this.stage = 'overview';
    this.session = null;
    this.feedback = null;
    this.answerText = '';
    this.openedHints.clear();
    this.loadSummary();
  }

  protected done(): void {
    this.resetAndLoad();
  }

  protected reencounter(itemId: string): void {
    if (this.submitting) return;
    this.submitting = true;
    this.reviewService.reencounter(itemId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.submitting = false;
        this.loadSummary();
      },
      error: error => {
        this.submitting = false;
        this.loadError = getErrorMessage(error, 'Could not prepare a new prompt for this word.');
      },
    });
  }

  protected intentLabel(intent: LearningIntent): string {
    return ({UNDERSTAND: 'Understand', PRODUCE: 'Produce', PRONOUNCE: 'Pronounce', DISAMBIGUATE: 'Tell apart', CHUNK: 'Use the chunk'})[intent];
  }

  protected intentInstruction(intent: LearningIntent): string {
    return intent === 'UNDERSTAND'
      ? 'Write what this means.'
      : intent === 'DISAMBIGUATE'
        ? 'Write the exact word that fits this meaning.'
        : 'Write it in the language you are learning.';
  }

  protected savedAgo(savedAt: Date): string {
    const days = Math.max(0, Math.floor((Date.now() - savedAt.getTime()) / 86_400_000));
    if (days === 0) return 'Saved today';
    return `Saved ${days} ${days === 1 ? 'day' : 'days'} ago`;
  }

  private resetAndLoad(): void {
    this.stage = 'overview';
    this.session = null;
    this.result = null;
    this.feedback = null;
    this.currentIndex = 0;
    this.answerText = '';
    this.openedHints.clear();
    this.loadSummary();
  }

  private loadSummary(): void {
    this.loading = true;
    this.loadError = '';
    this.reviewService.getSummary(this.selectedLanguage).pipe(takeUntil(this.destroy$)).subscribe({
      next: summary => {
        this.summary = summary;
        this.loading = false;
      },
      error: error => {
        this.summary = null;
        this.loading = false;
        this.loadError = getErrorMessage(error, 'Could not load your review queue. Please try again.');
      },
    });
  }

  private finishSession(): void {
    if (!this.session) return;
    this.submitting = true;
    this.reviewService.getResult(this.session.sessionId).pipe(takeUntil(this.destroy$)).subscribe({
      next: result => {
        this.result = result;
        this.stage = 'complete';
        this.submitting = false;
        this.learningActivity.stop(true);
      },
      error: error => {
        this.submitting = false;
        this.loadError = getErrorMessage(error, 'Could not load the session record. Please try again.');
      },
    });
  }
}
