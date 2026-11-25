import {Component, ChangeDetectionStrategy} from '@angular/core';
import {RouterLink} from '@angular/router';

/**
 * The dark footer under every public marketing surface: the landing and the legal pages. It
 * carries what the public navbar does not: the language table and the legal pages, and names
 * the seller, which Paddle's reviewers look for on every page.
 */
@Component({
  selector: 'app-public-footer',
  imports: [RouterLink],
  template: `
    <footer class="public-footer">
      <div class="footer-inner">
        <div class="footer-top">
          <div class="footer-brand-group">
            <a class="brand" routerLink="/" aria-label="Almonium home" i18n-aria-label>
              <img class="brand-emblem" src="/assets/img/logo/logo-flat-tint.svg" alt="">
              <img class="brand-wordmark" src="/assets/img/titles/wordmark-cream.svg" alt="">
            </a>
            <span class="tagline" i18n>Read anything. Keep every word.</span>
          </div>
          <nav aria-label="Footer navigation" i18n-aria-label>
            <a i18n routerLink="/languages">Languages</a>
            <a i18n routerLink="/terms-of-use">Terms</a>
            <a i18n routerLink="/privacy-policy">Privacy</a>
            <a i18n routerLink="/refund-policy">Refunds</a>
            <a i18n routerLink="/delete-account">Delete account</a>
          </nav>
        </div>
        <div class="footer-legal">
          <span i18n>© 2026 Almonium LLC</span>
          <!-- DB-IP's free country database places readers for the copyright rules; its licence (CC BY 4.0) asks for this credit. -->
          <a i18n href="https://db-ip.com" target="_blank" rel="noopener">IP geolocation by DB-IP</a>
        </div>
      </div>
    </footer>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host { display: block; }
    * { box-sizing: border-box; }
    .public-footer { background: #2c2530; color: #f9f6f5; font-family: var(--font-family-ui); }
    .footer-inner { max-width: 1120px; margin: 0 auto; padding: 40px 32px 28px; }
    .footer-top { display: flex; align-items: center; justify-content: space-between; gap: 16px 20px; flex-wrap: wrap; }
    .footer-brand-group { display: flex; align-items: center; gap: 12px 20px; flex-wrap: wrap; }
    a { color: inherit; text-decoration: none; }
    a:focus-visible { outline: 3px solid #c9a8c4; outline-offset: 3px; }
    .brand { display: inline-flex; align-items: center; gap: 11px; flex-shrink: 0; }
    .brand-emblem { display: block; width: 25px; height: 25px; }
    .brand-wordmark { display: block; height: 18px; width: auto; }
    .tagline { font-size: 13.5px; color: #a99aa8; white-space: nowrap; flex-shrink: 0; }
    nav { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 22px; font-size: 13.5px; }
    nav a { color: #c9c0cc; }
    .footer-legal {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #3d3542;
      display: flex;
      justify-content: space-between;
      gap: 8px 16px;
      flex-wrap: wrap;
      font-size: 12px;
      color: #8d8298;
    }
    .footer-legal a { color: #8d8298; }
    nav a:hover, .footer-legal a:hover { color: #f9f6f5; }
    @media (max-width: 700px) {
      .footer-inner { padding: 32px 18px 24px; }
    }
  `],
})
export class PublicFooterComponent {}
