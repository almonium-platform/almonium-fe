import {Component} from '@angular/core';
import {NavbarComponent} from "../../../shared/navbar/navbar.component";
import {NotReadyComponent} from "../../../shared/not-ready/not-ready.component";

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [
    NavbarComponent,
    NotReadyComponent
  ],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.less'
})
export class PrivacyPolicyComponent {

}
