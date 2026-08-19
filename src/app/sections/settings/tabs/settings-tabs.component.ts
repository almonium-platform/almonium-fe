import {Component} from '@angular/core';
import {RouterLink, RouterLinkActive} from "@angular/router";

@Component({
  selector: 'app-settings-tabs',
  imports: [
    RouterLink,
    RouterLinkActive,
  ],
  templateUrl: './settings-tabs.component.html',
  styleUrl: './settings-tabs.component.less'
})
export class SettingsTabsComponent {}
