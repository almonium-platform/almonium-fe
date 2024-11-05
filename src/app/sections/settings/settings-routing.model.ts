import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {AuthSettingsComponent} from './auth/auth-settings.component';

const settingsRoutes: Routes = [
  {path: '', redirectTo: 'auth', pathMatch: 'full'},
  {path: 'auth', component: AuthSettingsComponent},
];

@NgModule({
  imports: [RouterModule.forChild(settingsRoutes)],
  exports: [RouterModule]
})
export class SettingsRoutingModule {
}
