import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';

/**
 * The dark footer under every public marketing surface: the landing and the legal pages. Books,
 * Pricing and About are fragments of the landing, so from any other page they route home first.
 */
@Component({
  selector: 'app-public-footer',
  imports: [RouterLink],
  template: `
    <footer class="public-footer">
      <div class="footer-inner">
        <a class="brand" routerLink="/" aria-label="Almonium home" i18n-aria-label>
          <img class="brand-emblem" src="/assets/img/logo/logo-flat-tint.svg" alt="">
          <img class="brand-wordmark" src="/assets/img/titles/wordmark-cream.svg" alt="">
        </a>
        <p i18n>Read anything. Keep every word.</p>
        <nav aria-label="Footer navigation" i18n-aria-label>
          <a i18n routerLink="/" fragment="books">Books</a>
          <a i18n routerLink="/" fragment="pricing">Pricing</a>
          <a i18n routerLink="/" fragment="founder">About</a>
          <a i18n routerLink="/terms-of-use">Terms</a>
          <a i18n routerLink="/privacy-policy">Privacy</a>
        </nav>
      </div>
    </footer>
  `,
  styles: [`
    :host { display: block; }
    * { box-sizing: border-box; }
    .public-footer { background: #2c2530; color: #f9f6f5; font-family: var(--font-family-ui); }
    .footer-inner { display: flex; align-items: center; gap: 18px; width: min(calc(100% - 64px), 1056px); min-height: 104px; margin-inline: auto; }
    .footer-inner p { margin: 0; color: #a99aa8; font-size: 13px; }
    a { color: inherit; text-decoration: none; }
    a:hover { color: #872657; }
    a:focus-visible { outline: 3px solid #c9a8c4; outline-offset: 3px; }
    /* Horizontal lockup: the emblem's ink at the wordmark's cap-height, one cap-height between. */
    .brand { display: inline-flex; align-items: center; gap: 1rem; }
    .brand-emblem { display: block; width: 1.0625rem; height: 1.0625rem; }
    .brand-wordmark { display: block; width: 8rem; height: auto; }
    nav { display: flex; align-items: center; gap: 24px; margin-left: auto; font-size: 13px; }
    nav a { color: #c9c0cc; }
    @media (max-width: 700px) {
      .footer-inner { align-items: flex-start; flex-direction: column; width: min(calc(100% - 36px), 1056px); padding-block: 30px; }
      nav { margin: 0; flex-wrap: wrap; }
    }
  `],
})
export class PublicFooterComponent {}
