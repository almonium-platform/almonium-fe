import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {AuthSettingsComponent} from './auth/auth-settings.component';
import {LangSettingsComponent} from "./lang/lang-settings.component";
import {ProfileSettingsComponent} from "./profile/profile-settings.component";

const settingsRoutes: Routes = [
  {path: '', redirectTo: 'me', pathMatch: 'full'},
  {path: 'auth', component: AuthSettingsComponent},
  {path: 'lang', component: LangSettingsComponent},
  {path: 'me', component: ProfileSettingsComponent},
];

@NgModule({
  imports: [RouterModule.forChild(settingsRoutes)],
  exports: [RouterModule]
})
export class SettingsRoutingModule {
}
