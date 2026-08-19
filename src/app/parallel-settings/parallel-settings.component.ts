import {logger} from "../shared/logger";
import { ChangeDetectorRef, Component, OnDestroy, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import {TuiSegmented} from "@taiga-ui/kit/components";
import {ParallelMode} from '../sections/read/parallel-mode.type';
import {Subject, takeUntil} from "rxjs";
import {ParallelModeService} from "../sections/read/parallel-mode.service";

interface ModeConfig {
  imageSrc: string;
  altText: string;
  explanation: string;
}

@Component({
  selector: 'app-parallel-settings',
  imports: [
    TuiSegmented
  ],
  templateUrl: './parallel-settings.component.html',
  styleUrl: './parallel-settings.component.less'
})
export class ParallelSettingsComponent implements OnInit, OnDestroy {
  private parallelModeService = inject(ParallelModeService);
  private cdRef = inject(ChangeDetectorRef);

  @ViewChild('parallelSettings', {static: true}) content!: TemplateRef<unknown>;

  modeSelectedIndex = 0;

  // --- Define the configuration for each mode ---
  readonly modeConfigs: ModeConfig[] = [
    { // Index 0: Side By Side
      imageSrc: 'assets/img/icons/side.svg', // Replace with actual path
      altText: 'Side by Side View',
      explanation: 'Original and translation in aligned columns. Hover a sentence to match the pair.'
    },
    { // Index 1: Overlay
      imageSrc: 'assets/img/icons/overlay.svg', // Replace with actual path
      altText: 'Overlay View',
      explanation: 'Tap a sentence to reveal its translation directly underneath.'
    },
    { // Index 2: Inline
      imageSrc: 'assets/img/icons/inline.svg', // Replace with actual path
      altText: 'Inline View',
      explanation: 'Translation follows each original sentence in smaller grey text.'
    }
  ];

  private readonly modeIndexMap: Record<ParallelMode, number> = {
    'side': 0,
    'overlay': 1,
    'inline': 2
  };

  private readonly indexModeMap: Record<number, ParallelMode> = {
    0: 'side',
    1: 'overlay',
    2: 'inline'
  };

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    // Subscribe to mode changes from the service to update the segmented control
    this.parallelModeService.mode$
      .pipe(takeUntil(this.destroy$))
      .subscribe(mode => {
        const newIndex = this.modeIndexMap[mode];
        if (this.modeSelectedIndex !== newIndex) {
          this.modeSelectedIndex = newIndex;
          this.cdRef.markForCheck(); // Update view if needed
          logger.debug('Settings component updated index from service:', newIndex);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Getter to easily access the config for the selected mode ---
  get currentModeConfig(): ModeConfig {
    // Provide a default or handle out-of-bounds index if necessary
    return this.modeConfigs[this.modeSelectedIndex] ?? this.modeConfigs[0];
  }

  onModeIndexChange(newIndex: number): void {
    // Convert index back to mode string ('side', 'overlay', 'inline')
    const newMode = this.indexModeMap[newIndex];
    if (newMode) {
      logger.debug('Settings component sending mode to service:', newMode);
      // Set the mode via the service (this will also save to localStorage)
      this.parallelModeService.setMode(newMode);
    } else {
      logger.warn('Invalid index received from segmented control:', newIndex);
    }
  }
}
