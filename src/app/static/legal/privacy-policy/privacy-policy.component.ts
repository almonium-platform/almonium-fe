import {Component} from '@angular/core';
import {NavbarComponent} from "../../../shared/navbar/navbar.component";
import {NotReadyComponent} from "../../../shared/not-ready/not-ready.component";
import {NavbarWrapperComponent} from "../../../shared/navbar-wrapper/navbar-wrapper.component";

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [
    NavbarComponent,
    NotReadyComponent,
    NavbarWrapperComponent
  ],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.less'
})
export class PrivacyPolicyComponent {

}
