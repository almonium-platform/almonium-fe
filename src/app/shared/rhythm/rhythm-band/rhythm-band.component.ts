import {Component, Input} from '@angular/core';
import {LanguageRhythm, RhythmWeek, hasTarget} from '../rhythm.model';

/** The read-only face of one language's harness: a bar per week, and where this week stands. */
@Component({
  selector: 'app-rhythm-band',
  templateUrl: './rhythm-band.component.html',
  styleUrls: ['./rhythm-band.component.less'],
})
export class RhythmBandComponent {
  @Input({required: true}) rhythm!: LanguageRhythm;
  @Input() crest = 'var(--brand-primary)';

  protected isCurrent(week: RhythmWeek): boolean {
    return week === this.rhythm.weeks.at(-1);
  }

  protected get weeksMet(): number {
    return this.rhythm.weeks.filter(week => week.met).length;
  }

  protected get caption(): string {
    const week = this.rhythm.weeks.at(-1);
    if (!week) return '';
    return hasTarget(this.rhythm.target)
      ? `this week: ${week.daysMet} of ${this.rhythm.target} days`
      : `this week: ${week.daysMet} ${week.daysMet === 1 ? 'day' : 'days'}`;
  }
}
