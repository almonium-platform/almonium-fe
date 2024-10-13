import {Component} from '@angular/core';
import {NavbarComponent} from "../../../shared/navbar/navbar.component";
import {NotReadyComponent} from "../../../shared/not-ready/not-ready.component";
import {NavbarPublicComponent} from "../../../shared/navbar-public/navbar-public.component";
import {NavbarWrapperComponent} from "../../../shared/navbar-wrapper/navbar-wrapper.component";

@Component({
  selector: 'app-terms-of-use',
  standalone: true,
  imports: [
    NavbarComponent,
    NotReadyComponent,
    NavbarPublicComponent,
    NavbarWrapperComponent
  ],
  templateUrl: './terms-of-use.component.html',
  styleUrl: './terms-of-use.component.less'
})
export class TermsOfUseComponent {

}
