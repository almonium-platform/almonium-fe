import {TuiNotificationService} from "@taiga-ui/core/components";
import { Component, OnInit, ViewChild, inject } from '@angular/core';
import {PaywallComponent} from "../../shared/paywall/paywall.component";
import {NgTemplateOutlet} from "@angular/common";
import {ActivatedRoute} from "@angular/router";
import {UrlService} from "../../services/url.service";

@Component({
  selector: 'app-pricing',
  imports: [
    NgTemplateOutlet,
    PaywallComponent
  ],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.less'
})
export class PricingComponent implements OnInit {
  private activatedRoute = inject(ActivatedRoute);
  private alertService = inject(TuiNotificationService);
  private urlService = inject(UrlService);

  @ViewChild(PaywallComponent, {static: true}) paywallComponent!: PaywallComponent;

  ngOnInit(): void {
    this.activatedRoute.queryParams.subscribe(params => {
      if (params['canceled'] === 'true') {
        this.alertService.open('Something went wrong with your payment. Please try again.', {appearance: 'warning'}).subscribe();
        this.urlService.clearUrl();
      }
    });
  }
}
