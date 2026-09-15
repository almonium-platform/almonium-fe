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

  protected get bandLabel(): string {
    return $localize`Twelve weeks of learning in ${this.languageName}:language:`;
  }

  protected label(week: RhythmWeek): string {
    const weekStart = week.weekStart;
    if (week.frozen) return $localize`Week of ${weekStart}:weekStart:: set aside`;
    const minutes = weekMinutes(week);
    if (minutes === 0) return $localize`Week of ${weekStart}:weekStart:: nothing recorded`;
    return minutes === 1
      ? $localize`Week of ${weekStart}:weekStart:: 1 minute`
      : $localize`Week of ${weekStart}:weekStart:: ${minutes}:minutes: minutes`;
  }
}
