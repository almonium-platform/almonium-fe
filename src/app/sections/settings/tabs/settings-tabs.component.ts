import {TuiTabs} from "@taiga-ui/kit";
import {Component, WritableSignal} from '@angular/core';
import {RouterLink, RouterLinkActive} from "@angular/router";

@Component({
  selector: 'app-settings-tabs',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    TuiTabs
  ],
  templateUrl: './settings-tabs.component.html',
  styleUrl: './settings-tabs.component.less'
})
export class SettingsTabsComponent {
  activeItemIndex: number | WritableSignal<number>;

  constructor() {
    this.activeItemIndex = 0;
  }

  onClick(calls: string) {
    console.log(calls);
  }
}
