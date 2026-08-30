import {Component, Input} from '@angular/core';
import {Rhythm, RhythmWeek, hasTarget} from '../rhythm.model';

/** The read-only face of the harness: one bar per week, and where this week stands. */
@Component({
  selector: 'app-rhythm-band',
  templateUrl: './rhythm-band.component.html',
  styleUrls: ['./rhythm-band.component.less'],
})
export class RhythmBandComponent {
  @Input({required: true}) rhythm!: Rhythm;

  protected readonly hasTarget = hasTarget;

  protected isCurrent(week: RhythmWeek): boolean {
    return week === this.rhythm.weeks.at(-1);
  }

  protected get thisWeek(): RhythmWeek | null {
    return this.rhythm.weeks.at(-1) ?? null;
  }

  protected get caption(): string {
    const week = this.thisWeek;
    if (!week) return '';
    const days = `${week.daysMet} ${week.daysMet === 1 ? 'day' : 'days'}`;
    return hasTarget(this.rhythm.target)
      ? `this week: ${week.daysMet} of ${this.rhythm.target} days`
      : `this week: ${days}`;
  }
}
