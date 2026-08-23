import {Routes} from '@angular/router';
import {authGuard} from "./authentication/auth/guard/auth.guard";
import {unauthGuard} from "./authentication/auth/guard/unauth.guard";
import {adminGuard} from "./authentication/auth/guard/admin.guard";

export const routes: Routes = [
  {path: '', loadComponent: () => import('./sections/landing/landing.component').then(m => m.LandingComponent)},
  {
    path: '',
    canActivate: [unauthGuard],
    children: [
      // Authentication flow
      {path: 'auth', loadComponent: () => import('./authentication/login/login.component').then(m => m.LoginComponent)},
      {path: 'login', redirectTo: '/auth'},
      {path: 'reset-password', loadComponent: () => import('./authentication/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)},
    ]
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {path: 'onboarding', loadComponent: () => import('./onboarding/onboarding.component').then(m => m.OnboardingComponent)},
      {path: 'home', loadComponent: () => import('./sections/home/home.component').then(m => m.HomeComponent)},
      {path: 'review', loadComponent: () => import('./sections/review/review.component').then(m => m.ReviewComponent)},
      {path: 'my-books/import', loadComponent: () => import('./sections/read/book-import/book-import.component').then(m => m.BookImportComponent)},
      {path: 'my-books/:id', loadComponent: () => import('./sections/read/book-import/book-import.component').then(m => m.BookImportComponent)},
      {path: 'reader/private/:id', loadComponent: () => import('./sections/read/reader/reader.component').then(m => m.ReaderComponent)},
      {path: 'social', loadComponent: () => import('./sections/social/social.component').then(m => m.SocialComponent)},
      {path: 'membership', loadComponent: () => import('./sections/membership/membership.component').then(m => m.MembershipComponent)},
      {
        path: 'settings',
        loadChildren:
          () => import('../app/sections/settings/settings.module')
            .then(m => m.SettingsModule),
      },

      {path: 'ops', canActivate: [adminGuard], loadComponent: () => import('./ops/ops.component').then(m => m.OpsComponent)},

      // Games
      {path: 'play/ladder', loadComponent: () => import('./games/ladder/ladder.component').then(m => m.LadderComponent)},
      {path: 'play/higher-lower', loadComponent: () => import('./games/higher-lower/higher-lower.component').then(m => m.HigherLowerComponent)},
      {path: 'play/crossword', loadComponent: () => import('./games/crossword/crossword.component').then(m => m.CrosswordComponent)},
      {path: 'play/duel', loadComponent: () => import('./games/duel/duel.component').then(m => m.DuelComponent)},
    ]
  },

  {path: 'logout', loadComponent: () => import('./authentication/logout/logout.component').then(m => m.LogoutComponent)},
  {path: 'change-email', loadComponent: () => import('./authentication/email-verification/email-verification.component').then(m => m.EmailVerificationComponent)}, // same component, determine purpose by route
  {path: 'verify-email', loadComponent: () => import('./authentication/email-verification/email-verification.component').then(m => m.EmailVerificationComponent)},

  {path: 'users/:username', loadComponent: () => import('./shared/user-card/user-card.component').then(m => m.UserCardComponent)},

  // Static pages
  {path: 'terms-of-use', loadComponent: () => import('./static/legal/terms-of-use/terms-of-use.component').then(m => m.TermsOfUseComponent)},
  {path: 'privacy-policy', loadComponent: () => import('./static/legal/privacy-policy/privacy-policy.component').then(m => m.PrivacyPolicyComponent)},

  // Payment
  {path: 'payment/checkout', loadComponent: () => import('./static/payment-checkout/payment-checkout.component').then(m => m.PaymentCheckoutComponent)},
  {path: 'payment/success', loadComponent: () => import('./static/payment-success/payment-success.component').then(m => m.PaymentSuccessComponent)},

  // Marketing
  {path: 'pricing', loadComponent: () => import('./static/pricing/pricing.component').then(m => m.PricingComponent)},
  {path: 'about', loadComponent: () => import('./static/about-us/about.component').then(m => m.AboutComponent)},

  // sections of both auth and unauth
  {path: 'play', loadComponent: () => import('./sections/play/play.component').then(m => m.PlayComponent)},
  {path: 'discover', loadComponent: () => import('./sections/discover/discover.component').then(m => m.DiscoverComponent)},
  {path: 'read', loadComponent: () => import('./sections/read/read.component').then(m => m.ReadComponent)},
  {path: 'books/:slug', loadComponent: () => import('./sections/read/book/book.component').then(m => m.BookComponent)},
  {path: 'reader/:slug', loadComponent: () => import('./sections/read/reader/reader.component').then(m => m.ReaderComponent)},

  // Test route
  {path: 'test', loadComponent: () => import('./test/test.component').then(m => m.TestComponent)},
  {path: '404', loadComponent: () => import('./static/not-found/not-found.component').then(m => m.NotFoundComponent)},
  {path: '**', redirectTo: '404'}  // Fallback route for unknown paths
];
