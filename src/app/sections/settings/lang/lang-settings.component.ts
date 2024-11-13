import { Component } from '@angular/core';
import {ActionModalComponent} from "../../../shared/modals/action-modal/action-modal.component";
import {AsyncPipe, NgIf, NgTemplateOutlet} from "@angular/common";
import {AuthComponent} from "../../../authentication/auth/auth.component";
import {ConfirmModalComponent} from "../../../shared/modals/confirm-modal/confirm-modal.component";
import {EditButtonComponent} from "../../../shared/edit-button/edit-button.component";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {NavbarComponent} from "../../../shared/navbars/navbar/navbar.component";
import {ProviderIconComponent} from "../../../shared/modals/elements/provider-icon/provider-icon.component";
import {TuiErrorModule, TuiTextfieldControllerModule} from "@taiga-ui/core";
import {TuiFieldErrorPipeModule, TuiInputModule, TuiInputNumberModule, TuiInputPasswordModule} from "@taiga-ui/kit";
import {SettingsTabsComponent} from "../tabs/settings-tabs.component";

@Component({
  selector: 'app-lang-settings',
  standalone: true,
  imports: [
    ActionModalComponent,
    AsyncPipe,
    AuthComponent,
    ConfirmModalComponent,
    EditButtonComponent,
    FormsModule,
    NavbarComponent,
    NgIf,
    NgTemplateOutlet,
    ProviderIconComponent,
    ReactiveFormsModule,
    TuiErrorModule,
    TuiFieldErrorPipeModule,
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
