import {Component} from '@angular/core';
import {NavbarComponent} from "../../../shared/navbar/navbar.component";
import {NotReadyComponent} from "../../../shared/not-ready/not-ready.component";

@Component({
  selector: 'app-terms-of-use',
  standalone: true,
  imports: [
    NavbarComponent,
    NotReadyComponent
  ],
  templateUrl: './terms-of-use.component.html',
  styleUrl: './terms-of-use.component.less'
})
export class TermsOfUseComponent {

}
