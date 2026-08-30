import {Component, OnInit, inject} from '@angular/core';
import {AsyncPipe} from '@angular/common';
import {Observable} from 'rxjs';
import {logger} from '../../logger';
import {Rhythm, RhythmDay, RhythmWeek, WeeklyTarget, hasTarget, localDate} from '../rhythm.model';
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

/**
 * The harness — the learner's own target, not a streak.
 *
 * <p>Weeks are the unit, so missing a Tuesday is not a failure and there is no number that can be lost. The only
 * judgement here is against a bar the learner set themselves, and "No target" is a legitimate choice.
 */
@Component({
  selector: 'app-harness',
  templateUrl: './harness.component.html',
  styleUrls: ['./harness.component.less'],
  imports: [AsyncPipe, RhythmTargetComponent],
})
export class HarnessComponent implements OnInit {
  private readonly rhythmService = inject(RhythmService);

  protected readonly rhythm$: Observable<Rhythm | null> = this.rhythmService.rhythm$;
  protected readonly weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  protected readonly today = localDate();

  ngOnInit(): void {
    if (this.rhythmService.rhythm) return;
    this.rhythmService.load().subscribe({
      error: error => logger.error('Could not load your rhythm', error),
    });
  }

  protected shownWeeks(rhythm: Rhythm): RhythmWeek[] {
    return rhythm.weeks.slice(-ROWS);
  }

  protected currentWeek(rhythm: Rhythm): RhythmWeek | null {
    return rhythm.weeks.at(-1) ?? null;
  }

  protected isCurrentWeek(rhythm: Rhythm, week: RhythmWeek): boolean {
    return week === rhythm.weeks.at(-1);
  }

  protected weekLabel(weekStart: string): string {
    const [year, month, day] = weekStart.split('-').map(Number);
    return new Intl.DateTimeFormat(undefined, {month: 'short', day: 'numeric'})
      .format(new Date(year, month - 1, day));
  }

  /** Tint follows minutes, but any met day keeps a visible floor so a short session never reads as a blank. */
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
    return day.minutes > 0 ? `${day.date}: ${day.minutes} minutes` : `${day.date}: a short session`;
  }

  protected daysToGo(rhythm: Rhythm): number {
    const week = this.currentWeek(rhythm);
    if (!week || !hasTarget(rhythm.target)) return 0;
    return Math.max(rhythm.target - week.daysMet, 0);
  }

  protected weeksMet(rhythm: Rhythm): number {
    return rhythm.weeks.slice(0, -1).slice(-SUMMARISED_WEEKS).filter(week => week.met).length;
  }

  protected headline(target: WeeklyTarget): string {
    if (target === null) return 'Set your own pace';
    return hasTarget(target) ? CADENCE[target] ?? `${target} days a week` : 'No target';
  }

  protected readonly summarisedWeeks = SUMMARISED_WEEKS;
  protected readonly hasTarget = hasTarget;
}
