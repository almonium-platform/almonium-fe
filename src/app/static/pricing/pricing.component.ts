import {Component, OnInit, ViewChild} from '@angular/core';
import {NavbarWrapperComponent} from "../../shared/navbars/navbar-wrapper/navbar-wrapper.component";
import {PlanService} from "../../services/plan.service";
import {PaywallComponent} from "../../shared/paywall/paywall.component";
import {NgIf, NgTemplateOutlet} from "@angular/common";

@Component({
  selector: 'app-pricing',
  imports: [
    NavbarWrapperComponent,
    NgTemplateOutlet,
    NgIf,
    PaywallComponent
  ],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.less'
})
export class PricingComponent implements OnInit {
  @ViewChild(PaywallComponent, {static: true}) paywallComponent!: PaywallComponent;

  constructor(private planService: PlanService,) {
  }

  ngOnInit(): void {
    this.planService.getPlans().subscribe(plans => {
      console.log(plans);
    });
  }

}
