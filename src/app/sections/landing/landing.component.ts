import {Component, OnInit, inject} from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {LANDING_ACCOUNT_DELETED_PARAM} from '../../authentication/logout/logout-reason';
import {PaywallComponent} from '../../shared/paywall/paywall.component';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, NgTemplateOutlet, PaywallComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.less'
})
export class LandingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alerts = inject(TuiNotificationService);

  ngOnInit(): void {
    this.acknowledgeDeletedAccount();
  }

  /**
   * The logout route hard-reloads into `/?deleted=1` after an account is deleted, so the toast the
   * settings page would have shown cannot survive. It is shown here instead, once, and the flag is
   * dropped from the URL so a refresh or a shared link does not repeat it.
   */
  private acknowledgeDeletedAccount(): void {
    if (this.route.snapshot.queryParamMap.get(LANDING_ACCOUNT_DELETED_PARAM) !== '1') return;
    this.alerts.open('Your account has been deleted.', {appearance: 'positive'}).subscribe();
    void this.router.navigate([], {queryParams: {[LANDING_ACCOUNT_DELETED_PARAM]: null}, replaceUrl: true});
  }
}
