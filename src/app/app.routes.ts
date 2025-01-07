import {Routes} from '@angular/router';
import {AuthComponent} from './authentication/auth/auth.component';
import {HomeComponent} from "./sections/home/home.component";
import {ResetPasswordComponent} from "./authentication/reset-password/reset-password.component";
import {EmailVerificationComponent} from "./authentication/email-verification/email-verification.component";
import {DiscoverComponent} from "./sections/discover/discover.component";
import {TestComponent} from "./test/test.component";
import {PrivacyPolicyComponent} from "./static/legal/privacy-policy/privacy-policy.component";
import {TermsOfUseComponent} from "./static/legal/terms-of-use/terms-of-use.component";
import {LandingComponent} from "./sections/landing/landing.component";
import {LogoutComponent} from "./authentication/logout/logout.component";
import {ReviewComponent} from "./sections/review/review.component";
import {GamesComponent} from "./sections/games/games.component";
import {LadderComponent} from "./games/ladder/ladder.component";
import {HigherLowerComponent} from "./games/higher-lower/higher-lower.component";
import {CrosswordComponent} from "./games/crossword/crossword.component";
import {DuelComponent} from "./games/duel/duel.component";
import {authGuard} from "./authentication/auth/guard/auth.guard";
import {unauthGuard} from "./authentication/auth/guard/unauth.guard";
import {AboutComponent} from "./static/about-us/about.component";
import {NotFoundComponent} from "./static/not-found/not-found.component";
import {PricingComponent} from "./static/pricing/pricing.component";
import {PaymentSuccessComponent} from "./static/payment-success/payment-success.component";
import {OnboardingComponent} from "./onboarding/onboarding.component";
import {UserInfoResolver} from "./services/user-info.resolver";
import {LoginComponent} from "./authentication/login/login.component";

export const routes: Routes = [
  {path: '', component: LandingComponent},
  {
    path: '',
    canActivate: [unauthGuard],
    children: [
      // Authentication flow
      {path: 'auth', component: LoginComponent},
      {path: 'login', redirectTo: '/auth'},
      {path: 'reset-password', component: ResetPasswordComponent},
    ]
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {path: 'onboarding', component: OnboardingComponent},
      {path: 'home', component: HomeComponent},
      {path: 'review', component: ReviewComponent},
      {
        path: 'settings',
        loadChildren:
          () => import('../app/sections/settings/settings.module')
            .then(m => m.SettingsModule),
      },

      // Games
      {path: 'games/ladder', component: LadderComponent},
      {path: 'games/higher-lower', component: HigherLowerComponent},
      {path: 'games/crossword', component: CrosswordComponent},
      {path: 'games/duel', component: DuelComponent},
    ]
  },

  {path: 'logout', component: LogoutComponent},
  {path: 'change-email', component: EmailVerificationComponent}, // same component, determine purpose by route
  {path: 'verify-email', component: EmailVerificationComponent},

  // Static pages
  {path: 'terms-of-use', component: TermsOfUseComponent},
  {path: 'privacy-policy', component: PrivacyPolicyComponent},

  // Payment
  {
    path: 'payment/success',
    component: PaymentSuccessComponent,
    resolve: {userInfo: UserInfoResolver}
  },

  // Marketing
  {path: 'pricing', component: PricingComponent},
  {path: 'about', component: AboutComponent},

  // sections of both auth and unauth
  {path: 'games', component: GamesComponent},
  {path: 'discover', component: DiscoverComponent},

  // Test route
  {path: 'test', component: TestComponent},
  {path: 'not-found', component: NotFoundComponent},
  {path: '**', redirectTo: 'not-found'}  // Fallback route for unknown paths
];
