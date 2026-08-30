import {Component, EventEmitter, Input, Output} from '@angular/core';
import {LanguageRhythm, RhythmWeek, cadenceLabel, hasTarget, trackedWeeks, weeksAtPace} from '../rhythm.model';

/** One language's record, read-only: what you asked of it, how long it has run, and the weeks you kept. */
@Component({
  selector: 'app-rhythm-band',
  templateUrl: './rhythm-band.component.html',
  styleUrls: ['./rhythm-band.component.less'],
})
export class RhythmBandComponent {
  @Input({required: true}) rhythm!: LanguageRhythm;
  @Input({required: true}) languageName!: string;
  @Input() crest = 'var(--brand-primary)';
  @Output() readonly setPace = new EventEmitter<LanguageRhythm>();

  protected readonly hasTarget = hasTarget;

  protected get committed(): boolean {
    return hasTarget(this.rhythm.target);
  }

  protected get meta(): string {
    return this.committed ? `${cadenceLabel(this.rhythm.target)} · ${this.since}` : 'No target';
  }

  protected get weeksMet(): number {
    return weeksAtPace(this.rhythm);
  }

  protected get weeksCounted(): number {
    return trackedWeeks(this.rhythm).length;
  }

  protected isCurrent(week: RhythmWeek): boolean {
    return week === this.rhythm.weeks.at(-1);
  }

  /** A week before the language existed is not a week it missed. */
  protected isBeforeStart(week: RhythmWeek): boolean {
    return !trackedWeeks(this.rhythm).includes(week);
  }

  private get since(): string {
    const [year, month, day] = this.rhythm.startedAt.split('-').map(Number);
    const started = new Date(year, month - 1, day);
    const sameYear = started.getFullYear() === new Date().getFullYear();
    return `since ${new Intl.DateTimeFormat(undefined, sameYear ? {month: 'long'} : {month: 'long', year: 'numeric'})
      .format(started)}`;
  }
}
