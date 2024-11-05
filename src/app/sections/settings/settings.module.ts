import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {AuthSettingsComponent} from './auth/auth-settings.component';
import {SettingsRoutingModule} from "./settings-routing.model";

@NgModule({
  imports: [CommonModule, SettingsRoutingModule, AuthSettingsComponent],
})
export class SettingsModule {
}
