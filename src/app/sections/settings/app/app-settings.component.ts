import {Component, OnDestroy, OnInit} from "@angular/core";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {TuiInputModule, TuiInputNumberModule, TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {SettingsTabsComponent} from "../tabs/settings-tabs.component";
import {NotReadyComponent} from "../../../shared/not-ready/not-ready.component";

@Component({
  selector: 'app-app-settings',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TuiInputModule,
    TuiInputNumberModule,
    TuiTextfieldControllerModule,
    SettingsTabsComponent,
    NotReadyComponent
  ],
  templateUrl: './app-settings.component.html',
  styleUrl: './app-settings.component.less'
})
export class AppSettingsComponent implements OnInit, OnDestroy {
  constructor() {
  }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
  }
}
