import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal} from '@angular/core';
import {
  READER_FONT_FAMILIES,
  READER_LINE_SPACINGS,
  READER_SIZES,
  READER_WIDTHS,
  ReaderFont,
  ReaderTheme,
} from './reader-appearance';
import {ReaderAppearanceService} from './reader-appearance.service';

const DISMISS_DISTANCE = 80;

/**
 * The appearance panel (G25, G26): theme, typeface, size, line spacing and, where there is room, width. It has
 * no sample text: the page behind it repaints on every tap, so the book is the preview.
 */
@Component({
  selector: 'app-reader-appearance',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './reader-appearance.component.html',
  styleUrl: './reader-appearance.component.less',
})
export class ReaderAppearanceComponent {
  private readonly service = inject(ReaderAppearanceService);

  /** A phone shows the panel as a bottom sheet, with larger targets and no Width row. */
  @Input() sheet = false;
  /** The sheet was dragged down far enough to dismiss (G26). */
  @Output() readonly dismissed = new EventEmitter<void>();

  /** How far the sheet is being dragged down, in pixels; null when it is at rest. */
  protected readonly drag = signal<number | null>(null);
  private dragStart = 0;

  protected readonly appearance = this.service.appearance;
  protected readonly isDefault = this.service.isDefault;

  protected readonly themes: {key: ReaderTheme; label: string}[] = [
    {key: 'auto', label: $localize`Auto`},
    {key: 'paper', label: $localize`Paper`},
    {key: 'sepia', label: $localize`Sepia`},
    {key: 'night', label: $localize`Night`},
  ];

  /** Typeface names are proper names, set in their own face and not translated. */
  protected readonly fonts: {key: ReaderFont; label: string; family: string}[] = [
    {key: 'serif', label: 'Literata', family: READER_FONT_FAMILIES.serif},
    {key: 'sans', label: 'Plex Sans', family: READER_FONT_FAMILIES.sans},
    {key: 'atkinson', label: 'Atkinson', family: READER_FONT_FAMILIES.atkinson},
  ];

  protected readonly sizeSteps = READER_SIZES.map((_, index) => index);
  protected readonly lastSize = READER_SIZES.length - 1;

  protected readonly lineSpacings = [
    {index: 0, gap: 2, label: $localize`Tight line spacing`},
    {index: 1, gap: 4, label: $localize`Normal line spacing`},
    {index: 2, gap: 6, label: $localize`Loose line spacing`},
  ].slice(0, READER_LINE_SPACINGS.length);

  protected readonly widths = [
    {index: 0, bar: 8, label: $localize`Narrow column`},
    {index: 1, bar: 13, label: $localize`Medium column`},
    {index: 2, bar: 18, label: $localize`Wide column`},
  ].slice(0, READER_WIDTHS.length);

  protected startDrag(event: PointerEvent): void {
    this.dragStart = event.clientY;
    this.drag.set(0);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  protected moveDrag(event: PointerEvent): void {
    if (this.drag() !== null) this.drag.set(Math.max(0, event.clientY - this.dragStart));
  }

  /** Past 80px the sheet goes; short of it, it settles back. */
  protected endDrag(): void {
    const distance = this.drag();
    this.drag.set(null);
    if (distance !== null && distance > DISMISS_DISTANCE) this.dismissed.emit();
  }

  protected pickTheme(theme: ReaderTheme): void { this.service.change({theme}); }
  protected pickFont(font: ReaderFont): void { this.service.change({font}); }
  protected pickLineSpacing(lineSpacing: number): void { this.service.change({lineSpacing}); }
  protected pickWidth(width: number): void { this.service.change({width}); }
  protected smaller(): void { this.service.stepSize(-1); }
  protected larger(): void { this.service.stepSize(1); }
  protected reset(): void { this.service.reset(); }
}
