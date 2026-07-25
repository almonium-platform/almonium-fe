import {TuiNotificationService} from "@taiga-ui/core/components";
import { Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import {PaywallComponent} from "../../shared/paywall/paywall.component";
import {NgTemplateOutlet} from "@angular/common";
import {ActivatedRoute} from "@angular/router";
import {UrlService} from "../../services/url.service";
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

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
  private destroyRef = inject(DestroyRef);

  @ViewChild(PaywallComponent, {static: true}) paywallComponent!: PaywallComponent;

  ngOnInit(): void {
    this.activatedRoute.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      if (params['canceled'] === 'true') {
        this.alertService.open('Something went wrong with your payment. Please try again.', {appearance: 'warning'}).subscribe();
        this.urlService.clearUrl();
      }
    });
  }
}
