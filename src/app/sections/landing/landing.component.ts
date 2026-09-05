import {Component, DestroyRef, OnInit, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {HttpClient} from '@angular/common/http';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {LANDING_ACCOUNT_DELETED_PARAM} from '../../authentication/logout/logout-reason';
import {catchError, forkJoin, map, of} from 'rxjs';
import {AppConstants} from '../../app.constants';
import {PlanService} from '../../services/plan.service';
import {
  BillingPeriod,
  freeTierFeatures,
  paidTierFeatures,
  parseFoundingMemberStatus,
  periodLabel,
  PlanOffer,
} from '../../models/plan-offer';

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.less'
})
export class LandingComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly planService = inject(PlanService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alerts = inject(TuiNotificationService);

  /**
   * The same offer the paywall prices, from the same public endpoints. It was a pair of hardcoded
   * numbers, which is how a landing page ends up advertising a plan the checkout no longer sells.
   * Until it arrives the card shows no figure rather than guessing at one.
   */
  protected offer: PlanOffer | null = null;

  protected billingPeriod: BillingPeriod = 'monthly';

  // Signed out, so there is nothing to count against the ceiling.
  protected readonly freeFeatures: readonly string[] = freeTierFeatures(null);


  ngOnInit(): void {
    this.acknowledgeDeletedAccount();
    forkJoin({
      plans: this.planService.getPlans().pipe(catchError(() => of([]))),
      founder: this.http.get<unknown>(`${AppConstants.PUBLIC_URL}/founding-members`).pipe(
        map(parseFoundingMemberStatus),
        catchError(() => of(null)),
      ),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({plans, founder}) => {
      const offer = new PlanOffer(plans, founder);
      this.offer = offer;
      // The founder card leads with monthly, where the barrier matters more than the fee ratio;
      // plain Premium leads with annual.
      this.billingPeriod = offer.founderOfferAvailable ? 'monthly' : 'yearly';
    });
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

  protected choosePeriod(period: BillingPeriod): void {
    this.billingPeriod = period;
  }

  protected get paidPrice(): number | null {
    return this.offer?.priceFor(this.billingPeriod) ?? null;
  }

  protected get paidFeatures(): string[] {
    return paidTierFeatures(this.offer);
  }

  protected get struckPrice(): number | null {
    return this.offer?.struckPriceFor(this.billingPeriod) ?? null;
  }

  protected get founderLimitNote(): string {
    return this.offer?.founderLimitNote ?? '';
  }

  protected get cadenceNotes(): string[] {
    return this.offer?.cadenceNotes(this.billingPeriod) ?? [];
  }

  protected get pricePeriodLabel(): string {
    return periodLabel(this.billingPeriod);
  }
}
