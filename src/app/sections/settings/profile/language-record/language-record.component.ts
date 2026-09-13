import {Component, OnDestroy, OnInit, inject} from '@angular/core';
import {DecimalPipe} from '@angular/common';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {Subject, of} from 'rxjs';
import {catchError, switchMap, takeUntil} from 'rxjs/operators';
import {CardDto} from '../../../../models/card.model';
import {LanguageCode} from '../../../../models/language.enum';
import {CardService} from '../../../../services/card.service';
import {ActiveLanguagePolicy, switchAvailable} from '../../../../models/active-language-policy.model';
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
  protected policy: ActiveLanguagePolicy | null = null;
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
    this.languageApiService.getActiveLanguagePolicy()
      .pipe(catchError(() => of(null)), takeUntil(this.destroy$))
      .subscribe(policy => this.policy = policy);
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

  protected get switchAvailable(): boolean {
    return switchAvailable(this.policy);
  }

  /**
   * Inside the cooldown this sentence is the whole explanation: the button greys and says why in one line, rather
   * than greying silently and making the reader hunt for the rule.
   */
  protected get swapNote(): string {
    if (!this.policy || this.policy.allowance < 1) {
      return $localize`Making ${this.languageName}:language: active again returns it to your target languages.`;
    }
    const active = this.policy.languages.find(choice => choice.active && choice.language !== this.language);
    const replaced = active ? this.languageNameService.getLanguageName(active.language) : $localize`your active language`;
    const swap = $localize`Making ${this.languageName}:language: active sets ${replaced}:replaced: aside in its place.`;
    const next = this.policy.nextSwitchAllowedAt;
    return next && !this.switchAvailable
      ? $localize`${swap}:swap: You can change again on ${new Intl.DateTimeFormat($localize.locale, {day: 'numeric', month: 'long'}).format(next)}:date:.`
      : swap;
  }

  protected get statusLine(): string {
    if (!this.rhythm) return '';
    if (!this.setAside) return $localize`Active. Everything you learn here is counted.`;
    return this.rhythm.setAsideAt
      ? $localize`Set aside on ${this.formatDate(this.rhythm.setAsideAt)}:date:. Everything is kept.`
      : $localize`Set aside. Everything is kept.`;
  }

  /** The sentence names the day the count stopped, so a still fraction reads as a record rather than a fault. */
  protected get recordSentence(): string {
    if (!this.rhythm) return '';
    const {met, counted} = this.pace;
    if (counted === 0) return $localize`No weeks were counted before this language was set aside.`;

    const kept = counted === 1
      ? $localize`${numberWord(met)}:met: of ${numberWord(counted)}:counted: week`
      : $localize`${numberWord(met)}:met: of ${numberWord(counted)}:counted: weeks`;
    const bar = hasTarget(this.rhythm.target)
      ? $localize` met your target of ${cadenceLabel(this.rhythm.target).toLowerCase()}:target:`
      : $localize` were learned in`;
    if (!this.setAside) return $localize`${kept}:kept:${bar}:bar:. Tint shows time learning, not a score.`;

    const date = this.rhythm.setAsideAt
      ? $localize`, when you set ${this.languageName}:language: aside on ${this.formatDate(this.rhythm.setAsideAt)}:date:`
      : '';
    return $localize`${kept}:kept:${bar}:bar:${date}:date:. The weeks since are not counted against you.`;
  }

  protected wordMeta(card: CardDto): string {
    return card.iteration ? $localize`seen ${card.iteration}:count:×` : $localize`not yet reviewed`;
  }

  /** How far a word has come, as pips rather than a number: the record shows keeping, not scoring. */
  protected strength(card: CardDto): boolean[] {
    const seen = card.iteration ?? 0;
    return STRENGTH_PIPS.map(threshold => seen >= threshold);
  }

  protected makeActive(): void {
    if (!this.language || this.activating || !this.switchAvailable) return;
    this.activating = true;
    this.languageApiService.updateLearner(this.language, {active: true}).subscribe({
      next: () => {
        this.activating = false;
        this.userInfoService.fetchUserInfoFromServer().subscribe({error: () => undefined});
        this.rhythmService.load().subscribe({error: () => undefined});
        this.languageApiService.getActiveLanguagePolicy()
          .pipe(catchError(() => of(null)), takeUntil(this.destroy$))
          .subscribe(policy => this.policy = policy);
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
    return new Intl.DateTimeFormat($localize.locale, {day: 'numeric', month: 'long'}).format(new Date(year, month - 1, day));
  }
}
