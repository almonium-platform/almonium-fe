import {ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, inject} from '@angular/core';
import {CatalogHit} from './catalog.model';
import {LiveCountdown, ReaderFreeNote, countryName, liveCountdown, readerFreeNote} from './public-domain-day';

/**
 * The day a work under copyright becomes free to read where the reader is (W6): a live countdown to midnight on
 * 1 January when that is under five years away, one line naming the date when it is further. "Tell me on the day"
 * is a want with a date attached: it joins the queue, and the reader hears when the book arrives.
 */
@Component({
  selector: 'app-unlock-countdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (note; as note) {
      <div class="unlock" [class.unlock--date]="note.kind === 'date'">
        @if (note.kind === 'live' && left; as left) {
          <span i18n class="unlock__label">Free to read in {{ country }} in</span>
          <div class="unlock__tiles" role="timer" [attr.aria-label]="timerLabel(left)">
            @if (!left.lastDay) {
              <div class="unlock__tile"><span class="unlock__number">{{ left.days }}</span><span i18n class="unlock__unit">{left.days, plural, =1 {day} other {days}}</span></div>
            }
            <div class="unlock__tile"><span class="unlock__number">{{ left.hours }}</span><span i18n class="unlock__unit">{left.hours, plural, =1 {hour} other {hours}}</span></div>
            <div class="unlock__tile"><span class="unlock__number">{{ left.minutes }}</span><span i18n class="unlock__unit">{left.minutes, plural, =1 {minute} other {minutes}}</span></div>
            <div class="unlock__tile"><span class="unlock__number">{{ left.seconds }}</span><span i18n class="unlock__unit">{left.seconds, plural, =1 {second} other {seconds}}</span></div>
          </div>
        } @else {
          <span i18n class="unlock__label">Free to read in {{ country }} from 1 January {{ note.year }}.</span>
        }
        <span class="unlock__note">
          @if (note.kind === 'live') { <ng-container i18n>On 1 January {{ note.year }}.</ng-container> }
          @if (freeIn.length > 0) { <ng-container i18n>It’s already free in {{ freeIn }}.</ng-container> }
        </span>
        <span class="unlock__actions">
          @if (wanted) {
            <button i18n type="button" class="want-button want-button--wanted" [attr.aria-pressed]="true" [disabled]="busy" (click)="toggled.emit()">✓ We’ll tell you on 1 January</button>
          } @else {
            <button i18n type="button" class="want-button want-button--solid" [attr.aria-pressed]="false" [disabled]="busy" (click)="toggled.emit()">Tell me on the day</button>
          }
          <button i18n type="button" class="catalog-link" [attr.aria-expanded]="mapOpen" (click)="whereFree.emit()">Where it’s free</button>
        </span>
      </div>
    }
  `,
  styles: `
    :host { display: contents; }
    .unlock { display: flex; flex-direction: column; align-items: flex-start; gap: .5rem; margin-top: .35rem; }
    .unlock__label { color: var(--subhead-color); font-size: .82rem; }
    .unlock__tiles { display: flex; gap: .5rem; }
    .unlock__tile { display: flex; min-width: 3.4rem; flex-direction: column; align-items: center; padding: .45rem .5rem .35rem; border: 1px solid var(--hairline-color); border-radius: .6rem; background: var(--state-selected); }
    .unlock__number { color: var(--text-color); font-family: var(--font-family-reading); font-size: 1.35rem; font-variant-numeric: tabular-nums; font-weight: 600; line-height: 1.1; }
    .unlock__unit { color: var(--metadata-color); font-size: .64rem; letter-spacing: .04em; text-transform: uppercase; }
    .unlock__note { max-width: 60ch; color: var(--subhead-color); font-size: .8rem; line-height: 1.55; }
    .unlock__actions { display: flex; flex-wrap: wrap; align-items: center; gap: .6rem 1rem; margin-top: .15rem; }
    .want-button { min-height: 2rem; padding: .3rem .9rem; border: 1px solid color-mix(in srgb, var(--dark-raspberry) 45%, var(--card-color)); border-radius: 999px; background: transparent; color: var(--dark-raspberry); cursor: pointer; font: inherit; font-size: .78rem; font-weight: 600; white-space: nowrap; }
    .want-button--solid { border-color: var(--dark-raspberry); background: var(--dark-raspberry); color: var(--card-color); }
    .want-button--solid:hover { filter: brightness(.9); }
    .want-button--wanted { border-color: color-mix(in srgb, var(--success-color) 45%, var(--card-color)); color: var(--success-color); }
    .want-button:disabled { cursor: wait; opacity: .6; }
    .catalog-link { padding: 0; border: 0; background: transparent; color: var(--dark-raspberry); cursor: pointer; font: inherit; font-size: .82rem; font-weight: 600; }
    .catalog-link:hover { text-decoration: underline; }
  `,
})
export class UnlockCountdownComponent implements OnInit, OnDestroy {
  private zone = inject(NgZone);
  private changes = inject(ChangeDetectorRef);
  /** The protected best hit; the component shows nothing unless the server named the reader's year. */
  @Input({required: true}) hit!: CatalogHit;
  @Input() wanted = false;
  @Input() busy = false;
  @Input() mapOpen = false;
  /** "Tell me on the day" tapped, or tapped again to take it back: the parent owns the want. */
  @Output() readonly toggled = new EventEmitter<void>();
  @Output() readonly whereFree = new EventEmitter<void>();
  /** The clock the countdown reads; tests set it. */
  now: () => Date = () => new Date();
  protected left: LiveCountdown | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.tick();
    // The tick runs outside Angular so a second's change does not walk the whole page; only this card is marked.
    this.zone.runOutsideAngular(() => {
      this.timer = setInterval(() => this.tick(), 1000);
    });
  }

  ngOnDestroy(): void {
    if (this.timer !== null) clearInterval(this.timer);
  }

  protected get note(): ReaderFreeNote | null {
    return readerFreeNote(this.hit.readerFreeFrom, this.now());
  }

  protected get country(): string {
    return this.hit.readerCountry ? countryName(this.hit.readerCountry) : $localize`your country`;
  }

  /** "the United States, Canada and India": up to three, named in the reader's language. */
  protected get freeIn(): string {
    const names = this.hit.freeIn.map(code => countryName(code));
    if (names.length <= 1) return names[0] ?? '';
    return $localize`${names.slice(0, -1).join(', ')}:names: and ${names[names.length - 1]}:last:`;
  }

  protected timerLabel(left: LiveCountdown): string {
    return $localize`${left.days}:days: days, ${left.hours}:hours: hours, ${left.minutes}:minutes: minutes and ${left.seconds}:seconds: seconds`;
  }

  /** Public so a test can advance the clock without waiting a second. */
  tick(): void {
    const note = this.note;
    const next = note?.kind === 'live' ? liveCountdown(note.year, this.now()) : null;
    const changed = JSON.stringify(next) !== JSON.stringify(this.left);
    this.left = next;
    if (changed) this.changes.markForCheck();
  }
}
