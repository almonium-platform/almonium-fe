import {logger} from "../shared/logger";
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import {DEFAULT_PARALLEL_MODE, ParallelMode} from '../sections/read/parallel-mode.type';
import {Subject, takeUntil} from "rxjs";
import {ParallelModeService} from "../sections/read/parallel-mode.service";

interface ModeOption {
  mode: ParallelMode;
  label: string;
  explanation: string;
}

/**
 * The three parallel modes as three tiles (G5): the diagrams are drawn in ink and grey, the tile
 * is the selector, and the whole panel sits in the reader's bottom bar so the effect is visible
 * behind it.
 */
@Component({
  selector: 'app-parallel-settings',
  templateUrl: './parallel-settings.component.html',
  styleUrl: './parallel-settings.component.less',
})
export class ParallelSettingsComponent implements OnInit, OnDestroy {
  private parallelModeService = inject(ParallelModeService);
  private cdRef = inject(ChangeDetectorRef);

  protected currentMode: ParallelMode = DEFAULT_PARALLEL_MODE;

  protected readonly modeOptions: ModeOption[] = [
    {
      mode: 'side',
      label: $localize`Side by side`,
      explanation: $localize`Read both editions together. Marked sentences highlight their counterparts.`,
    },
    {
      mode: 'overlay',
      label: $localize`On demand`,
      explanation: $localize`Tap a passage to reveal its companion paragraph in grey ink.`,
    },
    {
      mode: 'inline',
      label: $localize`Inline`,
      explanation: $localize`Each paragraph followed by its companion version. Grey, one size down.`,
    },
  ];

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.parallelModeService.mode$
      .pipe(takeUntil(this.destroy$))
      .subscribe(mode => {
        if (this.currentMode !== mode) {
          this.currentMode = mode;
          this.cdRef.markForCheck();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected pick(mode: ParallelMode): void {
    logger.debug('Settings component sending mode to service:', mode);
    this.parallelModeService.setMode(mode);
  }
}
