import {Component} from '@angular/core';
import {NotReadyComponent} from "../../shared/not-ready/not-ready.component";
import {NavbarWrapperComponent} from "../../shared/navbars/navbar-wrapper/navbar-wrapper.component";

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [
    NotReadyComponent,
    NavbarWrapperComponent
  ],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.less'
})
export class PricingComponent {

}
