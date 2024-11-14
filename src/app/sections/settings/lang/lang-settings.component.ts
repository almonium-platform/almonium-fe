import {
  TuiInputModule,
  TuiInputNumberModule,
  TuiInputPasswordModule,
  TuiTextfieldControllerModule
} from "@taiga-ui/legacy";
import {Component} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {NavbarComponent} from "../../../shared/navbars/navbar/navbar.component";
import {SettingsTabsComponent} from "../tabs/settings-tabs.component";

@Component({
  selector: 'app-lang-settings',
  standalone: true,
  imports: [
    FormsModule,
    NavbarComponent,
    ReactiveFormsModule,
    TuiInputModule,
    TuiInputNumberModule,
    TuiInputPasswordModule,
    TuiTextfieldControllerModule,
    SettingsTabsComponent
  ],
  templateUrl: './lang-settings.component.html',
  styleUrl: './lang-settings.component.less'
})
export class LangSettingsComponent {

}
