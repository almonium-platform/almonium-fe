import {Component, OnInit, inject} from '@angular/core';
import {AsyncPipe} from '@angular/common';
import {Observable, combineLatest, map} from 'rxjs';
import {LanguageCode} from '../../../models/language.enum';
import {LanguageApiService} from '../../../services/language-api.service';
import {LanguageNameService} from '../../../services/language-name.service';
import {TargetLanguageDropdownService} from '../../../services/target-language-dropdown.service';
import {UserInfoService} from '../../../services/user-info.service';
import {logger} from '../../logger';
import {
  LanguageRhythm,
  RhythmWeek,
  TARGET_OPTIONS,
  WeeklyTarget,
  bandWeeks,
  cadenceLabel,
  hasTarget,
  numberWord,
  paceFraction,
  weekLevel,
  weekMinutes,
} from '../rhythm.model';
import {RhythmService} from '../rhythm.service';

/** Weeks the card shows. The band keeps more; twelve is what the sentence talks about. */
const WEEKS_SHOWN = 12;
const DEFAULT_CREST = '#7A6BB8';
const SESSION_WORD: Record<number, string> = {1: 'one session', 2: 'two sessions', 4: 'four sessions'};

interface RecordView {
  language: LanguageCode;
  languageName: string;
  rhythm: LanguageRhythm | null;
  loaded: boolean;
  crest: string;
}

/**
 * The record — twelve weeks, and the bar the learner set for this language.
 *
 * <p>Weeks are the unit, so missing a Tuesday is not a failure and there is no number that can be lost. The target
 * is edited here, in place, because this is the only surface that shows what changing it re-reads. A language that
 * has been set aside freezes: its weeks since read as neither met nor missed.
 */
@Component({
  selector: 'app-harness',
  templateUrl: './harness.component.html',
  styleUrls: ['./harness.component.less'],
  imports: [AsyncPipe],
})
export class HarnessComponent implements OnInit {
  private readonly rhythmService = inject(RhythmService);
  private readonly languageService = inject(TargetLanguageDropdownService);
  private readonly languageNameService = inject(LanguageNameService);
  private readonly languageApiService = inject(LanguageApiService);
  private readonly userInfoService = inject(UserInfoService);

  protected readonly view$: Observable<RecordView> = combineLatest([
    this.rhythmService.rhythm$,
    this.languageService.currentLanguage$,
    this.languageService.langColors$,
  ]).pipe(map(([rhythm, language, colours]) => ({
    language,
    languageName: this.languageNameService.getLanguageName(language),
    rhythm: RhythmService.forLanguage(rhythm, language),
    loaded: rhythm !== null,
    crest: colours[language] ?? DEFAULT_CREST,
  })));

  protected readonly options = TARGET_OPTIONS;
  protected editing = false;
  protected draft: WeeklyTarget = null;
  protected saving = false;

  ngOnInit(): void {
    if (this.rhythmService.rhythm) return;
    this.rhythmService.load().subscribe({
      error: error => logger.error('Could not load your record', error),
    });
  }

  protected shownWeeks(rhythm: LanguageRhythm): RhythmWeek[] {
    return bandWeeks(rhythm, WEEKS_SHOWN);
  }

  /** Nothing has happened yet, so the card asks for no commitment: there is nothing to measure one against. */
  protected isEmpty(rhythm: LanguageRhythm): boolean {
    return !this.shownWeeks(rhythm).some(week => week.daysMet > 0);
  }

  protected readonly tint = weekLevel;

  protected weekLabel(week: RhythmWeek): string {
    if (week.frozen) return `Week of ${week.weekStart}: set aside`;
    const minutes = weekMinutes(week);
    if (minutes === 0) return `Week of ${week.weekStart}: nothing recorded`;
    return `Week of ${week.weekStart}: ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  }

  protected cadence(target: WeeklyTarget): string {
    return cadenceLabel(target);
  }

  /** The sentence the card leads with, which is the whole of the judgement it makes. */
  protected summary(rhythm: LanguageRhythm, languageName: string): string {
    const {met, counted} = paceFraction(rhythm, WEEKS_SHOWN);

    if (!rhythm.editable) {
      const aside = rhythm.setAsideAt ? ` on ${this.formatDate(rhythm.setAsideAt)}` : '';
      return `${numberWord(met)} ${met === 1 ? 'week' : 'weeks'} met your target before you set ${languageName}`
        + ` aside${aside}. The weeks since are not counted against you.`;
    }
    if (this.isEmpty(rhythm)) {
      return 'Twelve weeks, filling in as you learn. You can set a target once there is something to measure.';
    }
    if (!hasTarget(rhythm.target)) {
      return 'Twelve weeks with no bar to meet. Tint shows time learning, not a score.';
    }
    return `${numberWord(met)} of the last ${numberWord(counted)} weeks met your target of`
      + ` ${SESSION_WORD[rhythm.target] ?? `${rhythm.target} sessions`}.`
      + ' Tint shows time learning, not a score.';
  }

  protected startEditing(rhythm: LanguageRhythm): void {
    this.draft = rhythm.target;
    this.editing = true;
  }

  protected cancelEditing(): void {
    this.editing = false;
  }

  protected save(rhythm: LanguageRhythm): void {
    if (this.saving || this.draft === rhythm.target) {
      this.editing = false;
      return;
    }
    this.saving = true;
    this.rhythmService.setTarget(rhythm.language, this.draft).subscribe({
      next: () => {
        this.saving = false;
        this.editing = false;
      },
      error: error => {
        this.saving = false;
        logger.error('Could not save your target', error);
      },
    });
  }

  protected makeActive(rhythm: LanguageRhythm): void {
    if (this.saving) return;
    this.saving = true;
    this.languageApiService.updateLearner(rhythm.language, {active: true}).subscribe({
      next: () => {
        this.saving = false;
        this.userInfoService.fetchUserInfoFromServer().subscribe({error: () => undefined});
        this.rhythmService.load().subscribe({error: () => undefined});
      },
      error: error => {
        this.saving = false;
        logger.error('Could not make this language active again', error);
      },
    });
  }

  private formatDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    return new Intl.DateTimeFormat(undefined, {day: 'numeric', month: 'long'}).format(new Date(year, month - 1, day));
  }
}
