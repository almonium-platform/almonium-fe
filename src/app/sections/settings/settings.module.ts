import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {AuthSettingsComponent} from './auth/auth-settings.component';
import {SettingsRoutingModule} from "./settings-routing.model";
import {ProfileSettingsComponent} from "./profile/profile-settings.component";
import {SharedLucideIconsModule} from "../../shared/shared-lucide-icons.module";

@NgModule({
  imports: [
    CommonModule,
    SettingsRoutingModule,
    AuthSettingsComponent,
    ProfileSettingsComponent,
    SharedLucideIconsModule
  ],
})
export class SettingsModule {
}
