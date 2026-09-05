import {Component, Input} from '@angular/core';
import {RouterLink} from '@angular/router';
import {SharedLinkStatus} from '../shared-link.model';

/**
 * A link with nothing behind it: the only place Almo appears on this surface. Revoked and deleted never share copy,
 * because the visitor's question differs - the deleted case answers, before it is asked, whether words added earlier
 * were lost. Neither ever says "Oops", "404" or "something went wrong", and the owner is never named.
 */
@Component({
  selector: 'app-dead-link',
  imports: [RouterLink],
  template: `
    <section class="dead-link" [class.deleted]="status === 'DELETED'">
      @if (status === 'DELETED') {
        <img src="/assets/img/almo/rest.webp" alt="" class="almo almo-rest">
        <h1>{{ object === 'deck' ? 'This deck was deleted' : 'This card was deleted' }}</h1>
        <p>Its words went with it. Nothing you added from it earlier has been touched.</p>
      } @else {
        <img src="/assets/img/almo/searching.webp" alt="" class="almo almo-searching">
        <h1>This link no longer works</h1>
        <p>The owner turned it off, so there is nothing here to open. If you still want the words, ask them for a new link.</p>
      }
      @if (signedIn) {
        <a routerLink="/review" class="action outline">Go to Review</a>
      } @else {
        <a routerLink="/" class="action solid">See what Almonium is</a>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }

    .dead-link {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: .875rem;
      padding: 2.375rem 2.125rem 2.5rem;
      text-align: center;
    }

    .deleted {
      border-radius: 1rem;
      background: var(--card-color);
      box-shadow: 0 1px 3px rgba(0, 0, 0, .1);
      padding: 1.875rem 1.625rem 2rem;
      gap: .75rem;
    }

    .almo { display: block; height: auto; image-rendering: auto; }
    .almo-searching { width: 8rem; }
    .almo-rest { width: 6.5rem; }

    h1 { margin: 0; font: 600 1.375rem/1.2 var(--font-family-reading); color: var(--text-color); }
    .deleted h1 { font-size: 1.25rem; }

    p {
      margin: 0;
      max-width: 38ch;
      color: var(--subhead-color);
      font-size: .875rem;
      line-height: 1.6;
      text-wrap: pretty;
    }

    .action {
      display: inline-flex;
      align-items: center;
      min-height: 2.75rem;
      margin-top: .25rem;
      padding: .6875rem 1.375rem;
      border-radius: 9999px;
      font: 600 .84375rem/1 var(--font-family-ui);
      text-decoration: none;
      transition: background-color 160ms ease, transform 160ms ease;
    }

    .solid { background: var(--brand-primary); color: var(--on-brand-color); box-shadow: 0 1px 2px rgba(72, 23, 125, .2); }
    .solid:hover { background: var(--brand-hover); transform: translateY(-1px); }
    .outline { border: 1.5px solid var(--text-color); color: var(--text-color); font-weight: 500; }
    .outline:hover { background: var(--state-hover); }
    .action:focus-visible { outline: 3px solid var(--brand-margin); outline-offset: 3px; }
  `],
})
export class DeadLinkComponent {
  @Input({required: true}) status!: SharedLinkStatus;
  @Input() object: 'deck' | 'card' = 'deck';
  @Input() signedIn = false;
}
