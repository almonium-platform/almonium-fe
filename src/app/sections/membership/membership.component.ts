import {Component, DestroyRef, inject, OnInit} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {HttpClient} from '@angular/common/http';
import {ActivatedRoute} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {BehaviorSubject, catchError, finalize, forkJoin, map, of, take} from 'rxjs';
import {AppConstants} from '../../app.constants';
import {PlanDto} from '../../models/plan.model';
import {PlanLimitKeys, PlanType, Subscription, UserInfo} from '../../models/userinfo.model';
import {CardService} from '../../services/card.service';
import {PlanService} from '../../services/plan.service';
import {UserInfoService} from '../../services/user-info.service';
import {ReadService} from '../read/read.service';
import {BookImportQuota} from '../read/book-import.model';
import {getErrorMessage} from '../../shared/http-error';
import {expectNumber, expectRecord} from '../../shared/runtime-validation';
import {UrlService} from '../../services/url.service';

type BillingPeriod = 'monthly' | 'yearly';

interface FoundingMemberStatus {
  capacity: number;
  claimed: number;
}

@Component({
  selector: 'app-membership',
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
  protected plans: PlanDto[] = [];
  protected foundingStatus: FoundingMemberStatus | null = null;
  protected readonly actionLoading$ = new BehaviorSubject(false);

  protected readonly premiumFeatures = [
    'Unlimited saved words',
    'Every target and fluent language',
    'Books adapted to your level — B1, B2, C1',
    'Import your own books — 3 a month',
    '10 hours of audio',
    'Sync across devices',
  ];

  ngOnInit(): void {
    this.userInfoService.userInfo$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(userInfo => {
        if (!userInfo) return;
        this.userInfo = userInfo;
        this.loadUsage(userInfo);
      });

    forkJoin({
      plans: this.planService.getPlans(),
      foundingStatus: this.http.get<unknown>(`${AppConstants.PUBLIC_URL}/founding-members`).pipe(
        map(parseFoundingMemberStatus),
        catchError(() => of(null)),
      ),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({plans, foundingStatus}) => {
        this.plans = plans;
        this.foundingStatus = foundingStatus;
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

  protected get targetLanguagesUsed(): number {
    return this.userInfo?.targetLangs.length ?? 0;
  }

  protected get fluentLanguagesUsed(): number {
    return this.userInfo?.fluentLangs.length ?? 0;
  }

  protected get targetLanguageLimit(): number {
    return this.displayLimit(this.subscription?.getLimit(PlanLimitKeys.MAX_TARGET_LANGS, 1), 1);
  }

  protected get fluentLanguageLimit(): number {
    return this.displayLimit(this.subscription?.getLimit(PlanLimitKeys.MAX_FLUENT_LANGS, 1), 1);
  }

  protected get selectedPlan(): PlanDto | undefined {
    const type = this.billingPeriod === 'monthly' ? 'MONTHLY' : 'YEARLY';
    return this.plans.find(plan => plan.type === type);
  }

  protected get publicPrice(): number | null {
    return this.selectedPlan?.price ?? null;
  }

  protected get offerPrice(): number | null {
    if (this.publicPrice === null) return null;
    if (!this.founderOfferAvailable) return this.publicPrice;
    return this.selectedPlan?.founderPrice ?? this.publicPrice;
  }

  protected get founderOfferAvailable(): boolean {
    return !!this.foundingStatus && this.foundingStatus.claimed < this.foundingStatus.capacity;
  }

  protected get founderSoldOut(): boolean {
    return !!this.foundingStatus && this.foundingStatus.claimed >= this.foundingStatus.capacity;
  }

  protected get founderCapacity(): number {
    return this.foundingStatus?.capacity ?? 0;
  }

  // While places remain, only the founder price is on screen. Once they are gone the founder
  // price is struck through: proof the offer was real, never a second price to reach for.
  protected get struckPrice(): number | null {
    if (!this.founderSoldOut) return null;
    const founderValue = this.selectedPlan?.founderPrice ?? null;
    return founderValue === this.offerPrice ? null : founderValue;
  }

  protected usagePercent(used: number | null, limit: number): number {
    if (used === null || limit <= 0) return 0;
    return Math.min(100, Math.max(0, (used / limit) * 100));
  }

  protected choosePeriod(period: BillingPeriod): void {
    this.billingPeriod = period;
  }

  protected becomeMember(): void {
    const plan = this.selectedPlan;
    if (!plan || this.actionLoading$.value) return;

    this.actionLoading$.next(true);
    this.planService.subscribeToPlan(String(plan.id), this.founderOfferAvailable).pipe(
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

function parseFoundingMemberStatus(value: unknown): FoundingMemberStatus {
  const status = expectRecord(value, 'founding-member status');
  return {
    capacity: expectNumber(status['capacity'], 'founding-member status.capacity'),
    claimed: expectNumber(status['claimed'], 'founding-member status.claimed'),
  };
}
