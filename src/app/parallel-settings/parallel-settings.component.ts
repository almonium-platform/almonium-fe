import {ChangeDetectorRef, Component, OnDestroy, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {TuiSegmented} from "@taiga-ui/kit";
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
  @ViewChild('parallelSettings', {static: true}) content!: TemplateRef<any>;

  modeSelectedIndex: number = 0;

  // --- Define the configuration for each mode ---
  readonly modeConfigs: ModeConfig[] = [
    { // Index 0: Side By Side
      imageSrc: 'assets/img/icons/side.svg', // Replace with actual path
      altText: 'Side by Side View',
      explanation: 'Displays the original text and its translation in separate columns, side-by-side. Be careful not to only read the version you understand.'
    },
    { // Index 1: Overlay
      imageSrc: 'assets/img/icons/overlay.svg', // Replace with actual path
      altText: 'Overlay View',
      explanation: 'Shows the original text. Click on a sentence or segment to reveal its translation in a popup or overlay.'
    },
    { // Index 2: Inline
      imageSrc: 'assets/img/icons/inline.svg', // Replace with actual path
      altText: 'Inline View',
      explanation: 'Interleaves the original text and its translation segment by segment, one after the other.'
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

  constructor(
    private parallelModeService: ParallelModeService,
    private cdRef: ChangeDetectorRef
  ) {
  }

  ngOnInit(): void {
    // Subscribe to mode changes from the service to update the segmented control
    this.parallelModeService.mode$
      .pipe(takeUntil(this.destroy$))
      .subscribe(mode => {
        const newIndex = this.modeIndexMap[mode];
        if (this.modeSelectedIndex !== newIndex) {
          this.modeSelectedIndex = newIndex;
          this.cdRef.markForCheck(); // Update view if needed
          console.log('Settings component updated index from service:', newIndex);
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
      console.log('Settings component sending mode to service:', newMode);
      // Set the mode via the service (this will also save to localStorage)
      this.parallelModeService.setMode(newMode);
    } else {
      console.warn('Invalid index received from segmented control:', newIndex);
    }
  }
}
