import {logger} from "../shared/logger";
import {ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject} from '@angular/core';
import {DEFAULT_PARALLEL_MODE, ParallelMode, parallelModeLabel} from '../sections/read/parallel-mode.type';
import {Subject, takeUntil} from "rxjs";
import {ParallelModeService} from "../sections/read/parallel-mode.service";

interface ModeOption {
  mode: ParallelMode;
  label: string;
  explanation: string;
}

/** One companion edition as the phone sheet lists it (L7). */
export interface CompanionRow {
  slug: string;
  /** Language and level in words, e.g. "Ukrainian · C1". */
  name: string;
  /** The edition kind in words, e.g. "Machine translation". */
  kind: string;
  code: string;
  selected: boolean;
}

/**
 * The mode picker (L5): rows, not cards. A 64px ink-and-grey diagram, the name, one line that holds
 * the only instructional hint. Under a hairline, the companion line with a Change link into the
 * companion menu. The Side by side row also holds the sentence-pairs switch (L8) while it is the
 * selected row. On a phone (L7) the same rows are a sheet that also lists the editions, since two
 * sheets for one decision is one too many; the sheet never shows the switch, as Side by side is not
 * offered there.
 */
@Component({
  selector: 'app-parallel-settings',
  templateUrl: './parallel-settings.component.html',
  styleUrl: './parallel-settings.component.less',
})
export class ParallelSettingsComponent implements OnInit, OnDestroy {
  private parallelModeService = inject(ParallelModeService);
  private cdRef = inject(ChangeDetectorRef);

  /** Side by side needs the window (L2); below it the row is absent and one line says why. */
  @Input() sideAvailable = true;
  /** A companion is open, so the mode rows apply. */
  @Input() companionOpen = false;
  /** The phone layout (L7): a sheet that lists the editions too. */
  @Input() sheet = false;
  /** The desktop companion line, e.g. "Companion: Ukrainian C1, machine translation". */
  @Input() companionLine = '';
  /** Faint underlines pairing the sentences in Side by side (L8); the switch under that row. */
  @Input() showPairs = false;
  @Input() editions: CompanionRow[] = [];
  @Input() hasOtherEditionTranslations = false;
  @Input() includeOtherEditionTranslations = true;

  @Output() changeCompanion = new EventEmitter<void>();
  @Output() showPairsToggled = new EventEmitter<void>();
  @Output() editionPicked = new EventEmitter<string | null>();
  @Output() otherEditionsToggled = new EventEmitter<void>();

  protected currentMode: ParallelMode = DEFAULT_PARALLEL_MODE;
  protected readonly onLabel = $localize`On`;
  protected readonly offLabel = $localize`Off`;

  private readonly allModes: ModeOption[] = [
    {
      mode: 'side',
      label: parallelModeLabel('side'),
      explanation: $localize`Both editions in two columns. Click a sentence to light its counterpart.`,
    },
    {
      mode: 'demand',
      label: parallelModeLabel('demand'),
      explanation: $localize`Read one edition. Tap a sentence to open its companion under it.`,
    },
    {
      mode: 'inline',
      label: parallelModeLabel('inline'),
      explanation: $localize`Every sentence followed by its companion, in smaller grey.`,
    },
  ];

  private destroy$ = new Subject<void>();

  protected get modeOptions(): ModeOption[] {
    return this.sideAvailable ? this.allModes : this.allModes.filter(option => option.mode !== 'side');
  }

  /** The row that reads as selected: the chosen mode, or On demand while Side by side lacks the window. */
  protected get shownMode(): ParallelMode {
    return this.currentMode === 'side' && !this.sideAvailable ? 'demand' : this.currentMode;
  }

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
