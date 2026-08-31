import {Component, OnDestroy, OnInit, inject} from '@angular/core';
import {DecimalPipe} from '@angular/common';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {Subject, of} from 'rxjs';
import {catchError, switchMap, takeUntil} from 'rxjs/operators';
import {CardDto} from '../../../../models/card.model';
import {LanguageCode} from '../../../../models/language.enum';
import {CardService} from '../../../../services/card.service';
import {LanguageApiService} from '../../../../services/language-api.service';
import {LanguageNameService} from '../../../../services/language-name.service';
import {LearningStats, LearningStatsService} from '../../../../services/learning-stats.service';
import {TargetLanguageDropdownService} from '../../../../services/target-language-dropdown.service';
import {UserInfoService} from '../../../../services/user-info.service';
import {logger} from '../../../../shared/logger';
import {LanguageRhythm, cadenceLabel, hasTarget, numberWord, paceFraction} from '../../../../shared/rhythm/rhythm.model';
import {RhythmBandComponent} from '../../../../shared/rhythm/rhythm-band/rhythm-band.component';
import {RhythmService} from '../../../../shared/rhythm/rhythm.service';
import {ReviewService} from '../../../review/review.service';

const WORDS_SHOWN = 3;
/** Four pips, and the review counts a word has to pass to light each one. */
const STRENGTH_PIPS = [1, 5, 10, 20];
const DEFAULT_CREST = '#7A6BB8';

/**
 * A language's record, read-only, on its own route.
 *
 * <p>Not a state of home: the switcher answers what you are doing now and every row in it must be actionable, so a
 * language you have put down is reached from the profile instead. Nothing here starts a session.
 */
@Component({
  selector: 'app-language-record',
  templateUrl: './language-record.component.html',
  styleUrls: ['./language-record.component.less'],
  imports: [RouterLink, DecimalPipe, RhythmBandComponent],
})
export class LanguageRecordComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly rhythmService = inject(RhythmService);
  private readonly languageService = inject(TargetLanguageDropdownService);
  private readonly languageNameService = inject(LanguageNameService);
  private readonly languageApiService = inject(LanguageApiService);
  private readonly learningStatsService = inject(LearningStatsService);
  private readonly cardService = inject(CardService);
  private readonly reviewService = inject(ReviewService);
  private readonly userInfoService = inject(UserInfoService);
  private readonly destroy$ = new Subject<void>();

  protected language: LanguageCode | null = null;
  protected rhythm: LanguageRhythm | null = null;
  protected stats: LearningStats | null = null;
  protected words: CardDto[] = [];
  protected dueCount = 0;
  protected activating = false;
  private langColors: Record<string, string> = {};

  ngOnInit(): void {
    this.languageService.langColors$.pipe(takeUntil(this.destroy$)).subscribe(colors => this.langColors = colors);
    this.rhythmService.rhythm$.pipe(takeUntil(this.destroy$)).subscribe(rhythm => {
      this.rhythm = RhythmService.forLanguage(rhythm, this.language);
    });

    this.route.paramMap.pipe(
      switchMap(params => {
        const code = (params.get('code') ?? '').toUpperCase();
        this.language = Object.values(LanguageCode).includes(code as LanguageCode) ? code as LanguageCode : null;
        if (!this.language) {
          void this.router.navigate(['/settings/me']);
          return of(null);
        }
        this.rhythm = RhythmService.forLanguage(this.rhythmService.rhythm, this.language);
        this.loadRecord(this.language);
        return of(null);
      }),
      takeUntil(this.destroy$),
    ).subscribe();

    this.rhythmService.load().subscribe({error: error => logger.error('Could not load your record', error)});
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected get languageName(): string {
    return this.language ? this.languageNameService.getLanguageName(this.language) : '';
  }

  protected get crest(): string {
    return this.language ? this.langColors[this.language] ?? DEFAULT_CREST : DEFAULT_CREST;
  }

  protected get setAside(): boolean {
    return this.rhythm !== null && !this.rhythm.editable;
  }

  protected get shownWords(): CardDto[] {
    return this.words.slice(0, WORDS_SHOWN);
  }

  protected get pace(): {met: number; counted: number} {
    return this.rhythm ? paceFraction(this.rhythm) : {met: 0, counted: 0};
  }

  protected get statusLine(): string {
    if (!this.rhythm) return '';
    if (!this.setAside) return 'Active. Everything you learn here is counted.';
    const date = this.rhythm.setAsideAt ? ` on ${this.formatDate(this.rhythm.setAsideAt)}` : '';
    return `Set aside${date}. Everything is kept.`;
  }

  /** The sentence names the day the count stopped, so a still fraction reads as a record rather than a fault. */
  protected get recordSentence(): string {
    if (!this.rhythm) return '';
    const {met, counted} = this.pace;
    if (counted === 0) return 'No weeks were counted before this language was set aside.';

    const kept = `${numberWord(met)} of ${numberWord(counted)} ${counted === 1 ? 'week' : 'weeks'}`;
    const bar = hasTarget(this.rhythm.target)
      ? ` met your target of ${cadenceLabel(this.rhythm.target).toLowerCase()}`
      : ' were learned in';
    if (!this.setAside) return `${kept}${bar}. Tint shows time learning, not a score.`;

    const date = this.rhythm.setAsideAt ? `, when you set ${this.languageName} aside on ${this.formatDate(this.rhythm.setAsideAt)}` : '';
    return `${kept}${bar}${date}. The weeks since are not counted against you.`;
  }

  protected wordMeta(card: CardDto): string {
    return card.iteration ? `seen ${card.iteration}×` : 'not yet reviewed';
  }

  /** How far a word has come, as pips rather than a number: the record shows keeping, not scoring. */
  protected strength(card: CardDto): boolean[] {
    const seen = card.iteration ?? 0;
    return STRENGTH_PIPS.map(threshold => seen >= threshold);
  }

  protected makeActive(): void {
    if (!this.language || this.activating) return;
    this.activating = true;
    this.languageApiService.updateLearner(this.language, {active: true}).subscribe({
      next: () => {
        this.activating = false;
        this.userInfoService.fetchUserInfoFromServer().subscribe({error: () => undefined});
        this.rhythmService.load().subscribe({error: () => undefined});
      },
      error: error => {
        this.activating = false;
        logger.error('Could not make this language active again', error);
      },
    });
  }

  private loadRecord(language: LanguageCode): void {
    this.learningStatsService.getStats(language)
      .pipe(catchError(() => of(null)), takeUntil(this.destroy$))
      .subscribe(stats => this.stats = stats);
    this.cardService.getCardsInLanguage(language)
      .pipe(catchError(() => of([] as CardDto[])), takeUntil(this.destroy$))
      .subscribe(words => this.words = words);
    this.reviewService.getSummary(language)
      .pipe(catchError(() => of(null)), takeUntil(this.destroy$))
      .subscribe(summary => this.dueCount = summary?.dueCount ?? 0);
  }

  private formatDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    return new Intl.DateTimeFormat(undefined, {day: 'numeric', month: 'long'}).format(new Date(year, month - 1, day));
  }
}
