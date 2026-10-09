import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';

/**
 * What a book page or the reader shows when the book answered 451: it is still under copyright in the reader's
 * country. A plain state of the page, not an error: no toast, no lock, one line of why and the way back.
 */
@Component({
  selector: 'app-unavailable-in-country',
  imports: [RouterLink],
  template: `
    <section class="unavailable" aria-labelledby="unavailable-title">
      <h1 i18n id="unavailable-title" class="unavailable__title">This book isn’t available in your country</h1>
      <p i18n class="unavailable__copy">Copyright lasts longer in some countries than others, so a few books can’t be opened everywhere.</p>
      <a i18n class="unavailable__back" routerLink="/read">Back to the shelf</a>
    </section>
  `,
  styles: [`
    :host { display: flex; flex: 1; align-items: center; justify-content: center; width: 100%; min-height: 60vh; padding: 3rem 1.25rem; box-sizing: border-box; }
    .unavailable { display: flex; max-width: 30rem; flex-direction: column; align-items: center; gap: .75rem; text-align: center; }
    .unavailable__title { margin: 0; color: var(--text-color); font-family: var(--font-family-reading); font-size: 1.5rem; font-weight: 600; line-height: 1.25; }
    .unavailable__copy { margin: 0; color: var(--subhead-color); font-size: .9rem; line-height: 1.6; }
    .unavailable__back { margin-top: .5rem; color: var(--dark-raspberry); font-size: .88rem; font-weight: 600; text-decoration: none; }
    .unavailable__back:hover { text-decoration: underline; }
  `],
})
export class UnavailableInCountryComponent {}
