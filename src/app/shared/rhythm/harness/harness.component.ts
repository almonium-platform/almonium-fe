import {Component, OnInit, inject} from '@angular/core';
import {AsyncPipe} from '@angular/common';
import {Observable, combineLatest, map} from 'rxjs';
import {LanguageCode} from '../../../models/language.enum';
import {TargetLanguageDropdownService} from '../../../services/target-language-dropdown.service';
import {logger} from '../../logger';
import {LanguageRhythm, RhythmDay, RhythmWeek, WeeklyTarget, hasTarget, localDate} from '../rhythm.model';
import {RhythmService} from '../rhythm.service';
import {RhythmTargetComponent} from '../rhythm-target/rhythm-target.component';

const CADENCE: Record<number, string> = {
  2: 'Two days a week',
  3: 'Three days a week',
  5: 'Five days a week',
  7: 'Every day',
};

/** Weeks shown in full, day by day: the four that finished and the one in progress. */
const ROWS = 5;
/** Weeks behind the summary line, as many as the band keeps once the current one is set aside. */
const SUMMARISED_WEEKS = 12;
const DEFAULT_CREST = '#7A6BB8';

interface HarnessView {
  language: LanguageCode;
  rhythm: LanguageRhythm | null;
  loaded: boolean;
  crest: string;
}

/**
 * The harness — the learner's own target for this language, not a streak.
 *
 * <p>Weeks are the unit, so missing a Tuesday is not a failure and there is no number that can be lost. The only
 * judgement here is against a bar the learner set themselves, and "No target" is a legitimate choice. Home shows
 * the active language alone, in that language's own colour, so the band says which commitment was kept.
 */
@Component({
  selector: 'app-harness',
  templateUrl: './harness.component.html',
  styleUrls: ['./harness.component.less'],
  imports: [AsyncPipe, RhythmTargetComponent],
})
export class HarnessComponent implements OnInit {
  private readonly rhythmService = inject(RhythmService);
  private readonly languageService = inject(TargetLanguageDropdownService);

  protected readonly view$: Observable<HarnessView> = combineLatest([
    this.rhythmService.rhythm$,
    this.languageService.currentLanguage$,
    this.languageService.langColors$,
  ]).pipe(map(([rhythm, language, colours]) => ({
    language,
    rhythm: RhythmService.forLanguage(rhythm, language),
    loaded: rhythm !== null,
    crest: colours[language] ?? DEFAULT_CREST,
  })));

  protected readonly weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  protected readonly today = localDate();
  protected readonly summarisedWeeks = SUMMARISED_WEEKS;
  protected readonly hasTarget = hasTarget;

  ngOnInit(): void {
    if (this.rhythmService.rhythm) return;
    this.rhythmService.load().subscribe({
      error: error => logger.error('Could not load your rhythm', error),
    });
  }

  protected shownWeeks(rhythm: LanguageRhythm): RhythmWeek[] {
    return rhythm.weeks.slice(-ROWS);
  }

  protected isCurrentWeek(rhythm: LanguageRhythm, week: RhythmWeek): boolean {
    return week === rhythm.weeks.at(-1);
  }

  protected weekLabel(weekStart: string): string {
    const [year, month, day] = weekStart.split('-').map(Number);
    return new Intl.DateTimeFormat(undefined, {month: 'short', day: 'numeric'})
      .format(new Date(year, month - 1, day));
  }

  /** Tint follows time learning, but any met day keeps a visible floor so a short session never reads as a blank. */
  protected tint(day: RhythmDay): number {
    if (!day.met) return 0;
    if (day.minutes >= 25) return 3;
    if (day.minutes >= 10) return 2;
    return 1;
  }

  protected isFuture(day: RhythmDay): boolean {
    return day.date > this.today;
  }

  protected dayLabel(day: RhythmDay): string {
    if (!day.met) return `${day.date}: nothing recorded`;
    if (day.minutes === 0) return `${day.date}: under a minute`;
    return `${day.date}: ${day.minutes} ${day.minutes === 1 ? 'minute' : 'minutes'}`;
  }

  protected daysToGo(rhythm: LanguageRhythm): number {
    const week = rhythm.weeks.at(-1);
    if (!week || !hasTarget(rhythm.target)) return 0;
    return Math.max(rhythm.target - week.daysMet, 0);
  }

  protected weeksMet(rhythm: LanguageRhythm): number {
    return rhythm.weeks.slice(0, -1).slice(-SUMMARISED_WEEKS).filter(week => week.met).length;
  }

  protected headline(target: WeeklyTarget): string {
    if (target === null) return 'Set your own pace';
    return hasTarget(target) ? CADENCE[target] ?? `${target} days a week` : 'No target';
  }
}
