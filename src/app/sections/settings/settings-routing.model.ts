import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {AuthSettingsComponent} from './auth/auth-settings.component';
import {LangSettingsComponent} from "./lang/lang-settings.component";

const settingsRoutes: Routes = [
  {path: '', redirectTo: 'auth', pathMatch: 'full'},
  {path: 'auth', component: AuthSettingsComponent},
  {path: 'lang', component: LangSettingsComponent},
];

@NgModule({
  imports: [RouterModule.forChild(settingsRoutes)],
  exports: [RouterModule]
})
export class SettingsRoutingModule {
}
