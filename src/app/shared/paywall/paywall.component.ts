import {logger} from "../logger";
import {getErrorMessage} from '../http-error';
import { Component, Input, OnDestroy, OnInit, TemplateRef, ViewChild, inject } from "@angular/core";
import {TuiNotificationService} from "@taiga-ui/core/components";

import {PlanService} from "../../services/plan.service";
import {UserInfoService} from "../../services/user-info.service";
import {BehaviorSubject, catchError, finalize, forkJoin, map, of, Subject, takeUntil} from "rxjs";
import {HttpClient} from '@angular/common/http';
import {Router} from "@angular/router";
import {getNextStep, isStepAfter, SetupStep, UserInfo} from "../../models/userinfo.model";
import {OnboardingService} from "../../onboarding/onboarding.service";
import {CardService} from "../../services/card.service";
import {AppConstants} from '../../app.constants';
import {expectNumber, expectRecord} from '../runtime-validation';

type BillingPeriod = 'monthly' | 'yearly';

interface FoundingMemberStatus {
  capacity: number;
  claimed: number;
}

// The free tier's saved-item ceiling. The backend has no plan-limit key for it, so the number
// lives here and prints in both the static line and the signed-in usage line.
const FREE_SAVED_ITEMS_LIMIT = 100;

// The claimed count is built but held off: a low number reads as "nobody wanted this". It goes
// on near twelve claimed, and from then reads "7 of 20 claimed".
const CLAIMED_COUNT_VISIBLE = false;

@Component({
  selector: 'app-paywall',
  templateUrl: './paywall.component.html',
  styleUrls: ['./paywall.component.less'],
})
export class PaywallComponent implements OnInit, OnDestroy {
  @Input() layout: 'modal' | 'page' = 'modal';

  private planService = inject(PlanService);
  private userInfoService = inject(UserInfoService);
  private onboardingService = inject(OnboardingService);
  private cardService = inject(CardService);
  private alertService = inject(TuiNotificationService);
  private router = inject(Router);
  private http = inject(HttpClient);

  private readonly destroy$ = new Subject<void>();
  @ViewChild('paywallContent', {static: true}) content!: TemplateRef<unknown>;
  private readonly step = SetupStep.LANGUAGES;

  private userInfo: UserInfo | null = null;
  protected planChosen = false;
  protected premium = false;
  protected savedItems: number | null = null;

  protected billingPeriod: BillingPeriod = 'yearly';

  protected readonly premiumFeatures: string[] = [
    'Unlimited reading and lookups',
    'Unlimited saved items and languages',
    'Sync across your devices',
    '10 hours of book audio',
    '3 book imports a month',
  ];

  private premiumPrice: Record<BillingPeriod, number | null> = {monthly: null, yearly: null};
  private founderPrice: Record<BillingPeriod, number | null> = {monthly: null, yearly: null};
  private planIds: Record<BillingPeriod, string> = {monthly: '', yearly: ''};
  private foundingStatus: FoundingMemberStatus | null = null;

  protected readonly freeLoading$ = new BehaviorSubject(false);
  protected readonly paidLoading$ = new BehaviorSubject(false);

  ngOnInit() {
    this.populatePlanInfo();
    this.populateUserInfo();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private populateUserInfo() {
    this.userInfoService.userInfo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(userInfo => {
        if (!userInfo) {
          return;
        }
        this.userInfo = userInfo;
        this.planChosen = isStepAfter(userInfo.setupStep, SetupStep.LANGUAGES);
        this.premium = userInfo.premium;
        this.loadSavedItems(userInfo);
      });
  }

  private populatePlanInfo() {
    forkJoin({
      plans: this.planService.getPlans(),
      founder: this.http.get<unknown>(`${AppConstants.PUBLIC_URL}/founding-members`).pipe(
        map(parseFoundingMemberStatus),
        catchError(() => of(null)),
      ),
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({plans, founder}) => {
        this.foundingStatus = founder;
        const monthlyPremium = plans.find(plan => plan.type === 'MONTHLY');
        const yearlyPremium = plans.find(plan => plan.type === 'YEARLY');
        if (monthlyPremium) {
          this.premiumPrice.monthly = monthlyPremium.price;
          this.founderPrice.monthly = monthlyPremium.founderPrice;
          this.planIds.monthly = String(monthlyPremium.id);
        }
        if (yearlyPremium) {
          this.premiumPrice.yearly = yearlyPremium.price;
          this.founderPrice.yearly = yearlyPremium.founderPrice;
          this.planIds.yearly = String(yearlyPremium.id);
        }
        // Premium preselects annual; the founder card preselects monthly, because the barrier
        // matters more there than the fee ratio.
        this.billingPeriod = this.founderOfferAvailable ? 'monthly' : 'yearly';
      },
      error: error => this.alertService.open(
        getErrorMessage(error, 'Could not load subscription plans'),
        {appearance: 'negative'},
      ).subscribe(),
    });
  }

  // Counting saved items means one request per target language, so it only runs on the full
  // pricing page, where the free card is the reader's own plan rather than a comparison.
  private loadSavedItems(userInfo: UserInfo) {
    if (this.layout !== 'page' || userInfo.premium || this.savedItems !== null) {
      return;
    }

    const languages = [...new Set(userInfo.targetLangs)];
    if (!languages.length) {
      this.savedItems = 0;
      return;
    }

    forkJoin(languages.map(language => this.cardService.getCardsInLanguage(language).pipe(
      catchError(() => of([])),
    ))).pipe(
      map(stacks => stacks.reduce((total, cards) => total + cards.length, 0)),
      takeUntil(this.destroy$),
    ).subscribe(total => this.savedItems = total);
  }

  protected get freeFeatures(): string[] {
    return [
      'Every book in the library, unlimited reading',
      'Unlimited lookups',
      this.savedItems === null
        ? `Up to ${FREE_SAVED_ITEMS_LIMIT} saved items`
        : `${this.savedItems} of ${FREE_SAVED_ITEMS_LIMIT} saved items`,
      'One language, unlimited review',
      'Confusion feedback',
    ];
  }

  protected get onFreePlan(): boolean {
    return !!this.userInfo && !this.premium && this.planChosen;
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

  protected get founderClaimed(): number {
    return this.foundingStatus?.claimed ?? 0;
  }

  protected get claimedCountVisible(): boolean {
    return CLAIMED_COUNT_VISIBLE && this.founderOfferAvailable;
  }

  protected get paidTierLabel(): string {
    return this.founderOfferAvailable ? 'Founding member' : 'Premium';
  }

  // The one price that applies to this visitor for the selected cadence — never a band, never
  // a range.
  protected get paidPrice(): number | null {
    const founderValue = this.founderPrice[this.billingPeriod];
    if (this.founderOfferAvailable && founderValue !== null) {
      return founderValue;
    }
    return this.premiumPrice[this.billingPeriod];
  }

  // Once the last place is gone the founder price is struck through: proof the offer was real,
  // in muted ink at body size so it never reads as something still selectable.
  protected get struckPrice(): number | null {
    if (!this.founderSoldOut) {
      return null;
    }
    const founderValue = this.founderPrice[this.billingPeriod];
    return founderValue === this.paidPrice ? null : founderValue;
  }

  protected get alternatePeriod(): BillingPeriod {
    return this.billingPeriod === 'monthly' ? 'yearly' : 'monthly';
  }

  protected get alternatePrice(): number | null {
    const period = this.alternatePeriod;
    const founderValue = this.founderPrice[period];
    if (this.founderOfferAvailable && founderValue !== null) {
      return founderValue;
    }
    return this.premiumPrice[period];
  }

  protected get alternateStruckPrice(): number | null {
    if (!this.founderSoldOut) {
      return null;
    }
    const founderValue = this.founderPrice[this.alternatePeriod];
    return founderValue === this.alternatePrice ? null : founderValue;
  }

  protected get alternateCadenceLabel(): string {
    if (this.alternatePrice === null) {
      return '';
    }
    return this.billingPeriod === 'monthly'
      ? `$${this.alternatePrice} a year on annual billing`
      : `$${this.alternatePrice} a month on monthly billing`;
  }

  protected get pricePeriodLabel(): string {
    return this.billingPeriod === 'monthly' ? '/ month' : '/ year';
  }

  protected get paidButtonText(): string {
    if (this.paidLoading$.value) {
      return 'Opening checkout…';
    }
    if (this.premium) {
      return 'Manage subscription';
    }
    return this.founderOfferAvailable ? 'Take a place' : 'Go Premium';
  }

  protected choosePeriod(period: BillingPeriod) {
    this.billingPeriod = period;
  }

  protected chooseFreePlan() {
    if (!this.userInfo) {
      void this.router.navigate(['/auth'], {fragment: 'sign-up'}).then();
      return;
    }
    if (this.planChosen) {
      logger.error('User is not onboarded');
      return;
    }

    this.freeLoading$.next(true);

    this.onboardingService.completeStep(this.step)
      .pipe(finalize(() => this.freeLoading$.next(false)))
      .subscribe({
        next: () => {
          this.userInfoService.updateUserInfo({setupStep: getNextStep(this.step)});
        },
        error: (error) => {
          logger.error('Failed to choose free plan:', error);
          this.alertService.open(getErrorMessage(error, 'Couldn\'t choose free plan'), {appearance: 'negative'}).subscribe();
        }
      });
  }

  protected onPaidAction() {
    if (this.premium) {
      this.accessCustomerPortal();
      return;
    }
    this.subscribeToPlan();
  }

  private subscribeToPlan() {
    if (!this.userInfo) {
      void this.router.navigate(['/auth'], {fragment: 'sign-up'}).then();
      return;
    }
    if (this.paidLoading$.value) {
      logger.warn('Rapid clicks detected');
      return;
    }

    this.paidLoading$.next(true);

    this.planService.subscribeToPlan(this.planIds[this.billingPeriod], this.founderOfferAvailable)
      .pipe(finalize(() => this.paidLoading$.next(false)))
      .subscribe({
        next: url => {
          window.location.href = url.sessionUrl;
        },
        error: error => this.alertService.open(
          getErrorMessage(error, 'Could not start checkout'),
          {appearance: 'negative'},
        ).subscribe(),
      });
  }

  private accessCustomerPortal() {
    if (this.paidLoading$.value) {
      return;
    }

    this.paidLoading$.next(true);
    this.planService.accessCustomerPortal()
      .pipe(finalize(() => this.paidLoading$.next(false)))
      .subscribe({
        next: url => {
          window.location.href = url.sessionUrl;
        },
        error: error => this.alertService.open(
          getErrorMessage(error, 'Could not open subscription management'),
          {appearance: 'negative'},
        ).subscribe(),
      });
  }
}

function parseFoundingMemberStatus(value: unknown): FoundingMemberStatus {
  const status = expectRecord(value, 'founding-member status');
  return {
    capacity: expectNumber(status['capacity'], 'founding-member status.capacity'),
    claimed: expectNumber(status['claimed'], 'founding-member status.claimed'),
  };
}
