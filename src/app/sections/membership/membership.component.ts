import {Component, DestroyRef, inject, OnInit} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {HttpClient} from '@angular/common/http';
import {ActivatedRoute} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {BehaviorSubject, catchError, finalize, forkJoin, map, of, take} from 'rxjs';
import {AppConstants} from '../../app.constants';
import {
  BillingPeriod,
  paidTierFeatures,
  parseFoundingMemberStatus,
  PlanOffer,
} from '../../models/plan-offer';
import {
  PlanLimitKeys,
  PlanType,
  ScheduledCadenceChange,
  Subscription,
  UserInfo,
} from '../../models/userinfo.model';
import {CadenceChangeKind, CadenceChangePreview} from '../../models/cadence-change.model';
import {CadenceChangeModalComponent} from '../../shared/modals/cadence-change/cadence-change-modal.component';
import {ConfirmModalComponent} from '../../shared/modals/confirm-modal/confirm-modal.component';
import {CardService} from '../../services/card.service';
import {PlanService} from '../../services/plan.service';
import {UserInfoService} from '../../services/user-info.service';
import {ReadService} from '../read/read.service';
import {BookImportQuota} from '../read/book-import.model';
import {getErrorMessage} from '../../shared/http-error';
import {expectBoolean, expectRecord} from '../../shared/runtime-validation';
import {UrlService} from '../../services/url.service';

@Component({
  selector: 'app-membership',
  imports: [CadenceChangeModalComponent, ConfirmModalComponent],
  templateUrl: './membership.component.html',
  styleUrl: './membership.component.less',
})
export class MembershipComponent implements OnInit {
  private readonly userInfoService = inject(UserInfoService);
  private readonly planService = inject(PlanService);
  private readonly cardService = inject(CardService);
  private readonly readService = inject(ReadService);
  private readonly http = inject(HttpClient);
  private readonly alerts = inject(TuiNotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly urlService = inject(UrlService);
  private readonly destroyRef = inject(DestroyRef);

  protected userInfo: UserInfo | null = null;
  protected savedWords: number | null = null;
  protected importQuota: BookImportQuota | null = null;
  protected billingPeriod: BillingPeriod = 'yearly';
  // The same offer the paywall and the landing page price, rather than a third reading of the
  // same two endpoints.
  private offer: PlanOffer | null = null;
  protected readonly actionLoading$ = new BehaviorSubject(false);

  protected cadencePreview: CadenceChangePreview | null = null;
  protected cadenceModalVisible = false;
  protected cadenceLoading = false;
  protected cadencePending = false;

  protected cancelModalVisible = false;
  protected cancelPending = false;

  protected annualNudgeEligible = false;
  protected annualOfferDismissed = readAnnualOfferDismissed();


  ngOnInit(): void {
    this.userInfoService.userInfo$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(userInfo => {
        if (!userInfo) return;
        this.userInfo = userInfo;
        this.loadUsage(userInfo);
        this.loadAnnualNudge(userInfo);
      });

    forkJoin({
      plans: this.planService.getPlans(),
      foundingStatus: this.http.get<unknown>(`${AppConstants.PUBLIC_URL}/founding-members`).pipe(
        map(parseFoundingMemberStatus),
        catchError(() => of(null)),
      ),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({plans, foundingStatus}) => {
        this.offer = new PlanOffer(plans, foundingStatus);
        // The founder offer preselects monthly, because the barrier matters more there than
        // the fee ratio; without it, annual leads.
        this.billingPeriod = this.founderOfferAvailable ? 'monthly' : 'yearly';
      },
      error: error => this.showError(error, 'Could not load membership options'),
    });

    this.route.queryParams.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      if (params['portal'] === 'from') {
        this.userInfoService.fetchUserInfoFromServer().subscribe();
        this.urlService.clearUrl();
      } else if (params['portal'] === 'to') {
        this.openCustomerPortal();
      }
    });
  }

  protected get premium(): boolean {
    return this.userInfo?.premium ?? false;
  }

  protected get subscription(): Subscription | null {
    return this.userInfo?.subscription ?? null;
  }

  protected get membershipTitle(): string {
    if (this.subscription?.type === PlanType.LIFETIME) return 'Lifetime member';
    if (this.subscription?.autoRenewal === false) return 'Premium until ' + this.formatDate(this.subscription.endDate);
    return 'Premium member';
  }

  protected get renewalLabel(): string {
    if (this.subscription?.type === PlanType.LIFETIME) return 'No renewal needed';
    if (!this.subscription?.endDate) return 'Active membership';
    return `${this.subscription.autoRenewal ? 'Renews' : 'Access ends'} ${this.formatDate(this.subscription.endDate)}`;
  }

  protected get memberSinceLabel(): string {
    return this.subscription?.startDate
      ? this.formatDate(this.subscription.startDate)
      : '—';
  }

  protected get activeLanguagesUsed(): number {
    return this.userInfo?.activeTargetLangs.length ?? 0;
  }

  protected get fluentLanguagesUsed(): number {
    return this.userInfo?.fluentLangs.length ?? 0;
  }

  // The storage ceiling is the same on every plan, so quoting it here would print the same number to a member and
  // a free account. What the plan actually moves is how many may be active. Absent means unlimited, which the row
  // prints rather than flattening to a fallback digit.
  protected get activeLanguageLimit(): number {
    const limit = this.subscription?.getLimit(PlanLimitKeys.MAX_ACTIVE_LANGS, -1);
    return limit === undefined || !Number.isFinite(limit) ? -1 : limit;
  }

  protected get fluentLanguageLimit(): number {
    return this.displayLimit(this.subscription?.getLimit(PlanLimitKeys.MAX_FLUENT_LANGS, 1), 1);
  }

  protected get premiumFeatures(): string[] {
    return paidTierFeatures(this.offer);
  }

  protected get selectedPlanId(): string {
    return this.offer?.planId(this.billingPeriod) ?? '';
  }

  protected get offerPrice(): number | null {
    return this.offer?.priceFor(this.billingPeriod) ?? null;
  }

  protected get struckPrice(): number | null {
    return this.offer?.struckPriceFor(this.billingPeriod) ?? null;
  }

  protected get cadenceNotes(): string[] {
    return this.offer?.cadenceNotes(this.billingPeriod) ?? [];
  }

  protected get founderOfferAvailable(): boolean {
    return !!this.offer?.founderOfferAvailable;
  }

  protected get founderLimitNote(): string {
    return this.offer?.founderLimitNote ?? '';
  }

  protected usagePercent(used: number | null, limit: number): number {
    if (used === null || limit <= 0) return 0;
    return Math.min(100, Math.max(0, (used / limit) * 100));
  }

  protected choosePeriod(period: BillingPeriod): void {
    this.billingPeriod = period;
  }

  protected becomeMember(): void {
    const planId = this.selectedPlanId;
    if (!planId || this.actionLoading$.value) return;

    this.actionLoading$.next(true);
    this.planService.subscribeToPlan(planId, this.founderOfferAvailable).pipe(
      finalize(() => this.actionLoading$.next(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: response => window.location.href = response.sessionUrl,
      error: error => this.showError(error, 'Could not start checkout'),
    });
  }

  protected openCustomerPortal(): void {
    if (this.actionLoading$.value) return;

    this.actionLoading$.next(true);
    this.planService.accessCustomerPortal().pipe(
      finalize(() => this.actionLoading$.next(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: response => window.location.href = response.sessionUrl,
      error: error => this.showError(error, 'Could not open subscription management'),
    });
  }

  // ---- Billing cadence -------------------------------------------------------------------

  protected get scheduledChange(): ScheduledCadenceChange | null {
    return this.subscription?.scheduledChange ?? null;
  }

  protected get oppositeCadence(): PlanType | null {
    if (!this.subscription || this.subscription.type === PlanType.LIFETIME) return null;
    return this.subscription.type === PlanType.MONTHLY ? PlanType.YEARLY : PlanType.MONTHLY;
  }

  protected get cadenceSwitchLabel(): string {
    return this.oppositeCadence === PlanType.YEARLY ? 'Switch to annual billing' : 'Switch to monthly billing';
  }

  protected scheduledChangeLabel(change: ScheduledCadenceChange): string {
    const cadence = change.type === PlanType.YEARLY ? 'Annual' : 'Monthly';
    return `${cadence} from ${this.formatDate(change.effectiveAt)}`;
  }

  protected openCadenceChange(): void {
    const target = this.oppositeCadence;
    if (!target || this.cadenceLoading) return;

    this.cadenceLoading = true;
    this.planService.previewCadenceChange(target).pipe(
      finalize(() => this.cadenceLoading = false),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: preview => {
        this.cadencePreview = preview;
        this.cadenceModalVisible = true;
      },
      error: error => this.showError(error, 'Could not work out what that change would cost'),
    });
  }

  protected confirmCadenceChange(option: CadenceChangeKind): void {
    const target = this.cadencePreview?.targetType;
    if (!target || this.cadencePending) return;

    this.cadencePending = true;
    this.planService.changeCadence(target, option).pipe(
      finalize(() => this.cadencePending = false),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.cadenceModalVisible = false;
        this.dismissAnnualOffer();
        this.userInfoService.fetchUserInfoFromServer().subscribe();
        this.alerts.open('Your billing has been updated.', {appearance: 'positive'}).subscribe();
      },
      error: error => this.showError(error, 'Could not change your billing'),
    });
  }

  protected closeCadenceModal(): void {
    this.cadenceModalVisible = false;
  }

  /** A pending change must be reversible in one action. One without an undo generates support mail. */
  protected undoScheduledChange(): void {
    if (this.cadenceLoading) return;

    this.cadenceLoading = true;
    this.planService.undoCadenceChange().pipe(
      finalize(() => this.cadenceLoading = false),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => this.userInfoService.fetchUserInfoFromServer().subscribe(),
      error: error => this.showError(error, 'Could not cancel the scheduled change'),
    });
  }

  // ---- The annual offer, after eight sessions --------------------------------------------

  protected get annualOfferVisible(): boolean {
    return this.annualNudgeEligible && !this.annualOfferDismissed && !this.scheduledChange;
  }

  /** The member's own tier, priced as arithmetic: a founder keeps the founder rate whatever the offer's state today. */
  protected get annualPromptLine(): string | null {
    return this.offer?.annualPromptLine(this.subscription?.founder ?? false) ?? null;
  }

  protected acceptAnnualOffer(): void {
    this.dismissAnnualOffer();
    this.openCadenceChange();
  }

  /** Shown once. Opening the switch yourself counts as having seen it. */
  protected dismissAnnualOffer(): void {
    this.annualOfferDismissed = true;
    try {
      localStorage.setItem(ANNUAL_OFFER_SEEN_KEY, 'true');
    } catch {
      // A browser that refuses storage shows the offer again next visit. Not a reason to fail the click.
    }
  }

  // ---- Cancellation ----------------------------------------------------------------------

  protected get cancellationAccessEndsOn(): string {
    return this.formatDate(this.subscription?.endDate ?? null);
  }

  protected openCancellation(): void {
    this.cancelModalVisible = true;
  }

  protected closeCancellation(): void {
    this.cancelModalVisible = false;
  }

  protected confirmCancellation(): void {
    if (this.cancelPending) return;

    this.cancelPending = true;
    this.planService.cancelSubscription().pipe(
      finalize(() => this.cancelPending = false),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.cancelModalVisible = false;
        this.userInfoService.fetchUserInfoFromServer().subscribe();
      },
      error: error => this.showError(error, 'Could not cancel your subscription'),
    });
  }

  private loadUsage(userInfo: UserInfo): void {
    const languages = [...new Set(userInfo.targetLangs)];
    const cardRequests = languages.map(language => this.cardService.getCardsInLanguage(language).pipe(
      catchError(() => of([])),
    ));

    (cardRequests.length ? forkJoin(cardRequests) : of([])).pipe(
      map(stacks => stacks.reduce((total, cards) => total + cards.length, 0)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(total => this.savedWords = total);

    if (userInfo.premium) {
      this.readService.getBookImportQuota().pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(quota => this.importQuota = quota);
    }
  }

  /** One request, and only for a paying member: nobody else can be offered a cheaper cadence. */
  private loadAnnualNudge(userInfo: UserInfo): void {
    if (!userInfo.premium || this.annualOfferDismissed) return;

    this.http.get<unknown>(`${AppConstants.SUBSCRIPTION_URL}/annual-nudge`, {withCredentials: true}).pipe(
      map(value => expectBoolean(expectRecord(value, 'annual nudge')['eligible'], 'annual nudge.eligible')),
      catchError(() => of(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(eligible => this.annualNudgeEligible = eligible);
  }

  private displayLimit(limit: number | undefined, fallback: number): number {
    return limit === undefined || !Number.isFinite(limit) || limit < 0 ? fallback : limit;
  }

  private formatDate(date: Date | null): string {
    if (!date) return 'your billing date';
    return date.toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'});
  }

  private showError(error: unknown, fallback: string): void {
    this.alerts.open(getErrorMessage(error, fallback), {appearance: 'negative'}).subscribe();
  }
}

const ANNUAL_OFFER_SEEN_KEY = 'almonium.annualOfferSeen';

function readAnnualOfferDismissed(): boolean {
  try {
    return localStorage.getItem(ANNUAL_OFFER_SEEN_KEY) === 'true';
  } catch {
    return false;
  }
}
