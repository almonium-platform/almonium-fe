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
import {LanguageSetupComponent} from "./authentication/language-setup/language-setup.component";
import {SettingsComponent} from "./sections/settings/settings.component";
import {TrainingComponent} from "./sections/training/training.component";
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

export const routes: Routes = [
  {path: '', component: LandingComponent},
  {
    path: '',
    canActivate: [unauthGuard],
    children: [
      // Authentication flow
      {path: 'auth', component: AuthComponent, canActivate: [unauthGuard]},
      // when settings will be ready, those will be moved to unguarded routes
      {path: 'verify-email', component: EmailVerificationComponent},
      {path: 'reset-password', component: ResetPasswordComponent},
    ]
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {path: 'home', component: HomeComponent, canActivate: [authGuard]},
      {path: 'training', component: TrainingComponent, canActivate: [authGuard]},
      {path: 'settings', component: SettingsComponent},
      {path: 'setup-languages', component: LanguageSetupComponent},

      // Games
      {path: 'games/ladder', component: LadderComponent},
      {path: 'games/higher-lower', component: HigherLowerComponent},
      {path: 'games/crossword', component: CrosswordComponent},
      {path: 'games/duel', component: DuelComponent},
    ]
  },

  {path: 'logout', component: LogoutComponent},

  // Static pages
  {path: 'terms-of-use', component: TermsOfUseComponent},
  {path: 'privacy-policy', component: PrivacyPolicyComponent},

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
