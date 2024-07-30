import {Routes} from '@angular/router';
import {AuthComponent} from './auth/auth.component';
import {HomeComponent} from "./home/home.component";
import {ResetPasswordComponent} from "./reset-password/reset-password.component";
import {EmailVerificationComponent} from "./email-verification/email-verification.component";

export const routes: Routes = [
  {path: 'auth', component: AuthComponent},
  {path: 'home', component: HomeComponent},
  {path: 'verify-email', component: EmailVerificationComponent},
  {path: 'reset-password', component: ResetPasswordComponent},
];
