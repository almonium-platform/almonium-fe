import {Component} from '@angular/core';
import {NgTemplateOutlet} from "@angular/common";
import {UpgradeComponent} from "../../shared/upgrade/upgrade.component";

@Component({
  selector: 'app-payment-success',
  imports: [
    NgTemplateOutlet,
    UpgradeComponent
  ],
  templateUrl: './payment-success.component.html',
  styleUrl: './payment-success.component.less'
})
export class PaymentSuccessComponent {
}
