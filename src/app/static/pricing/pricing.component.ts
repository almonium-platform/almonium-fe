import {Component, OnInit, ViewChild} from '@angular/core';
import {NavbarWrapperComponent} from "../../shared/navbars/navbar-wrapper/navbar-wrapper.component";
import {PaywallComponent} from "../../shared/paywall/paywall.component";
import {NgIf, NgTemplateOutlet} from "@angular/common";
import {ActivatedRoute} from "@angular/router";
import {TuiAlertService} from "@taiga-ui/core";
import {UrlService} from "../../services/url.service";

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

  constructor(
    private activatedRoute: ActivatedRoute,
    private alertService: TuiAlertService,
    private urlService: UrlService
  ) {
  }

  ngOnInit(): void {
    this.activatedRoute.queryParams.subscribe(params => {
      if (params['canceled'] === 'true') {
        this.alertService.open('Something went wrong with your payment. Please try again.', {appearance: 'warning'}).subscribe();
        this.urlService.clearUrl();
      }
    });
  }
}
