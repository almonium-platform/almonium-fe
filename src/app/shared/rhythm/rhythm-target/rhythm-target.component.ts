import {Component, Input, inject} from '@angular/core';
import {logger} from '../../logger';
import {TARGET_OPTIONS, WeeklyTarget} from '../rhythm.model';
import {RhythmService} from '../rhythm.service';

/** The only lever the harness offers: the bar the learner sets for themselves. */
@Component({
  selector: 'app-rhythm-target',
  templateUrl: './rhythm-target.component.html',
  styleUrls: ['./rhythm-target.component.less'],
})
export class RhythmTargetComponent {
  private readonly rhythmService = inject(RhythmService);

  @Input() target: WeeklyTarget = null;
  @Input() label = 'Target';

  protected readonly options = TARGET_OPTIONS;
  protected saving = false;

  protected choose(value: number): void {
    if (this.saving || this.target === value) return;

    const previous = this.target;
    this.target = value;
    this.saving = true;
    this.rhythmService.setTarget(value).subscribe({
      next: () => this.saving = false,
      error: error => {
        this.target = previous;
        this.saving = false;
        logger.error('Could not save the weekly target', error);
      },
    });
  }
}
