import {Component} from '@angular/core';
import {NavbarWrapperComponent} from "../../shared/navbars/navbar-wrapper/navbar-wrapper.component";
import {NgOptimizedImage} from "@angular/common";
import {Router} from "@angular/router";

@Component({
  selector: 'app-payment-success',
  imports: [
    NavbarWrapperComponent,
    NgOptimizedImage
  ],
  templateUrl: './payment-success.component.html',
  styleUrl: './payment-success.component.less'
})
export class PaymentSuccessComponent {
  constructor(
    protected router: Router,
  ) {
  }
}
