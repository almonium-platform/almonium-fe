import {afterNextRender, Component, ElementRef, inject, input, signal} from '@angular/core';
import {DatePipe} from '@angular/common';
import {RouterLink} from '@angular/router';
import {PublicFooterComponent} from '../../../shared/public-footer/public-footer.component';

export type LegalPage = 'privacy' | 'terms';

/**
 * The shell both legal pages share: a sticky rail that switches between them and jumps to
 * sections, a heading block, the projected body, and the dark public footer. The rail's section
 * links are read off the body's `h2[id]` headings after render, so a page declares each section
 * once, in its template, and the rail follows whatever the translation says.
 */
@Component({
  selector: 'app-legal-page',
  imports: [DatePipe, RouterLink, PublicFooterComponent],
  templateUrl: './legal-page.component.html',
  styleUrl: './legal-page.component.less',
})
export class LegalPageComponent {
  readonly current = input.required<LegalPage>();
  readonly title = input.required<string>();
  readonly lede = input.required<string>();
  readonly updated = input.required<Date>();

  protected readonly sections = signal<{id: string; label: string}[]>([]);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      const headings = this.host.nativeElement.querySelectorAll<HTMLHeadingElement>('.legal-body h2[id]');
      this.sections.set(Array.from(headings, h => ({id: h.id, label: h.textContent?.trim() ?? ''})));
    });
  }
}
