import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {FreeFromNote} from './public-domain-day';

/**
 * One line about a work's public domain day, worded in one place for every screen that shows it: "Free in 84 days"
 * when it is next 1 January (a small green chip with a spark, the one celebratory touch), "Free on 1 January 2047 ·
 * in 21 years" when later, "Free since 1 January" for a work that turned free this year. `muted` drops the chip
 * for a list where every row counts down to the same day.
 */
@Component({
  selector: 'app-free-from-note',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (note; as note) {
      @switch (note.kind) {
        @case ('countdown') {
          <span class="free-note" [class.free-note--chip]="!muted"><span class="free-note__spark" aria-hidden="true">✦</span><ng-container i18n>{note.days, plural, =0 {Free today} =1 {Free tomorrow} other {Free in {{ note.days }} days}}</ng-container></span>
        }
        @case ('later') {
          <span class="free-note"><ng-container i18n>Free on 1 January {{ note.year }}</ng-container> · <ng-container i18n>{note.years, plural, =1 {in a year} other {in {{ note.years }} years}}</ng-container></span>
        }
        @case ('freeSince') {
          <span i18n class="free-note free-note--since">Free since 1 January</span>
        }
      }
    }
  `,
  styles: `
    :host { display: contents; }
    .free-note { color: var(--metadata-color); font-size: .74rem; white-space: nowrap; }
    .free-note__spark { display: none; }
    .free-note--chip { display: inline-flex; align-items: center; gap: .3rem; padding: .2rem .6rem; border-radius: 999px; background: var(--success-bg-color); color: var(--success-color); font-size: .7rem; font-weight: 600; }
    .free-note--chip .free-note__spark { display: inline; font-size: .65rem; }
    .free-note--since { color: var(--success-color); font-weight: 500; }
    :host-context(html[data-theme='dark']) .free-note--chip { background: color-mix(in srgb, var(--success-color) 18%, transparent); }
  `,
})
export class FreeFromNoteComponent {
  @Input() note: FreeFromNote | null = null;
  @Input() muted = false;
}
