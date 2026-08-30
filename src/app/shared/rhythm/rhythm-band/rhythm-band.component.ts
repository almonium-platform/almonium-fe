import {Component, Input} from '@angular/core';
import {LanguageRhythm, RhythmWeek, bandWeeks, weekLevel, weekMinutes} from '../rhythm.model';

/** The twelve weeks, read-only, in the same ramp they wear on home. */
@Component({
  selector: 'app-rhythm-band',
  templateUrl: './rhythm-band.component.html',
  styleUrls: ['./rhythm-band.component.less'],
})
export class RhythmBandComponent {
  @Input({required: true}) rhythm!: LanguageRhythm;
  @Input({required: true}) languageName!: string;
  @Input() crest = 'var(--brand-primary)';

  protected readonly tint = weekLevel;

  protected get weeks(): RhythmWeek[] {
    return bandWeeks(this.rhythm);
  }

  protected label(week: RhythmWeek): string {
    if (week.frozen) return `Week of ${week.weekStart}: set aside`;
    const minutes = weekMinutes(week);
    if (minutes === 0) return `Week of ${week.weekStart}: nothing recorded`;
    return `Week of ${week.weekStart}: ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  }
}
