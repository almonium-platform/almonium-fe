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
import {NotFoundComponent} from "./static/not-found/not-found.component";
import {authGuard} from './authentication/auth/auth.guard';
import {LadderComponent} from "./games/ladder/ladder.component";
import {HigherLowerComponent} from "./games/higher-lower/higher-lower.component";
import {CrosswordComponent} from "./games/crossword/crossword.component";
import {DuelComponent} from "./games/duel/duel.component";

export const routes: Routes = [
  {path: '', component: LandingComponent},
  {path: 'auth', component: AuthComponent, canActivate: [authGuard]},
  {path: 'home', component: HomeComponent},
  {path: 'verify-email', component: EmailVerificationComponent},
  {path: 'reset-password', component: ResetPasswordComponent},
  {path: 'discover', component: DiscoverComponent},
  {path: 'test', component: TestComponent},
  {path: 'terms-of-use', component: TermsOfUseComponent},
  {path: 'privacy-policy', component: PrivacyPolicyComponent},
  {path: 'logout', component: LogoutComponent},
  {path: 'setup-languages', component: LanguageSetupComponent},
  {path: 'settings', component: SettingsComponent},
  {path: 'training', component: TrainingComponent},
  {path: 'games', component: GamesComponent},
  {path: 'games/ladder', component: LadderComponent},
  {path: 'games/higher-lower', component: HigherLowerComponent},
  {path: 'games/crossword', component: CrosswordComponent},
  {path: 'games/duel', component: DuelComponent},
  {path: 'not-found', component: NotFoundComponent},
  {path: '**', redirectTo: 'not-found'}  // Fallback route for unknown paths
];
