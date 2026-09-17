import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';

/**
 * The signed-out footer of a shared page. The page is a landing for someone who has never seen Almonium, so it needs
 * an exit that is not the back button, and Report sits here on every shared page: strangers now send strangers a page
 * carrying an owner-typed title.
 */
@Component({
  selector: 'app-shared-footer',
  imports: [RouterLink],
  template: `
    <footer class="shared-footer">
      <div class="footer-inner">
        <a routerLink="/" class="brand" aria-label="Almonium home" i18n-aria-label>
          <span class="app-icon" role="img" aria-hidden="true"></span>
          <span i18n>Reading in another language</span>
        </a>
        <nav aria-label="Footer navigation" i18n-aria-label>
          <a i18n routerLink="/privacy-policy">Privacy</a>
          <a i18n routerLink="/terms-of-use">Terms</a>
          <a i18n href="mailto:support@almonium.com?subject=Report%20a%20shared%20page">Report</a>
        </nav>
      </div>
    </footer>
  `,
  styles: [`
    :host { display: block; }

    .shared-footer {
      border-top: 1px solid var(--hairline-color);
      background: var(--card-color);
    }

    .footer-inner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1.125rem;
      width: min(100% - 2rem, 40rem);
      margin: 0 auto;
      padding: .875rem 0;
      color: var(--subhead-color);
      font-size: .75rem;
    }

    .brand { display: inline-flex; align-items: center; gap: .625rem; color: inherit; text-decoration: none; }

    .app-icon {
      display: block;
      width: 1rem;
      height: 1rem;
      background: var(--brand-flat-logo-image) center / contain no-repeat;
      opacity: .55;
    }

    nav { display: flex; flex-wrap: wrap; gap: 1rem; margin-left: auto; }
    nav a { color: inherit; text-decoration: none; }
    nav a:hover { color: var(--dark-raspberry); }

    @media (max-width: 40rem) {
      nav { margin-left: 0; }
    }
  `],
})
export class SharedFooterComponent {}
