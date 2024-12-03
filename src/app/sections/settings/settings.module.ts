import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {AuthSettingsComponent} from './auth/auth-settings.component';
import {SettingsRoutingModule} from "./settings-routing.model";
import {ProfileSettingsComponent} from "./profile/profile-settings.component";
import {Home, LucideAngularModule, Menu, RefreshCw, RefreshCwOff, StarOff, UserCheck} from "lucide-angular";

@NgModule({
  imports: [
    CommonModule,
    SettingsRoutingModule,
    AuthSettingsComponent,
    ProfileSettingsComponent,
    LucideAngularModule.pick({Home, Menu, UserCheck, StarOff, RefreshCw, RefreshCwOff}),
  ],
})
export class SettingsModule {
}
