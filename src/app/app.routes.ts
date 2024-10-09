import {Routes} from '@angular/router';
import {AuthComponent} from './auth/auth.component';
import {HomeComponent} from "./home/home.component";
import {ResetPasswordComponent} from "./reset-password/reset-password.component";
import {EmailVerificationComponent} from "./email-verification/email-verification.component";
import {DiscoverComponent} from "./discover/discover.component";
import {TextComponent} from "./text/text.component";
import {PrivacyPolicyComponent} from "./privacy-policy/privacy-policy.component";
import {TermsOfUseComponent} from "./terms-of-use/terms-of-use.component";
import {LandingComponent} from "./landing/landing.component";
import {LogoutComponent} from "./logout/logout.component";
import {LanguageSetupComponent} from "./language-setup/language-setup.component";
import {SettingsComponent} from "./settings/settings.component";
import {TrainingComponent} from "./training/training.component";
import {GamesComponent} from "./games/games.component";
import {NotFoundComponent} from "./not-found/not-found.component";
import {authGuard} from './auth/auth.guard';

export const routes: Routes = [
  {path: '', component: LandingComponent},
  {path: 'auth', component: AuthComponent, canActivate: [authGuard]},
  {path: 'home', component: HomeComponent},
  {path: 'verify-email', component: EmailVerificationComponent},
  {path: 'reset-password', component: ResetPasswordComponent},
  {path: 'discover', component: DiscoverComponent},
  {path: 'text', component: TextComponent},
  {path: 'terms-of-use', component: TermsOfUseComponent},
  {path: 'privacy-policy', component: PrivacyPolicyComponent},
  {path: 'logout', component: LogoutComponent},
  {path: 'setup-languages', component: LanguageSetupComponent},
  {path: 'settings', component: SettingsComponent},
  {path: 'training', component: TrainingComponent},
  {path: 'games', component: GamesComponent},
  {path: 'not-found', component: NotFoundComponent},
  {path: '**', redirectTo: 'not-found'}  // Fallback route for unknown paths
];
