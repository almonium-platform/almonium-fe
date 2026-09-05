import {logger} from "../logger";
import {getErrorMessage} from '../http-error';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, TemplateRef, ViewChild, inject } from "@angular/core";
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
import {
  BillingPeriod,
  freeTierFeatures,
  paidTierFeatures,
  parseFoundingMemberStatus,
  periodLabel,
  PlanOffer,
} from '../../models/plan-offer';

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
  // Set when the paywall is a detour inside another dialog: the reader came from somewhere with
  // unfinished work, so the head offers the way back instead of only a dismiss.
  @Input() backLabel: string | null = null;
  @Output() back = new EventEmitter<void>();

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


  private offer: PlanOffer | null = null;

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
        this.offer = new PlanOffer(plans, founder);
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
    return freeTierFeatures(this.savedItems);
  }

  protected get premiumFeatures(): string[] {
    return paidTierFeatures(this.offer);
  }

  protected get onFreePlan(): boolean {
    return !!this.userInfo && !this.premium && this.planChosen;
  }

  protected get founderOfferAvailable(): boolean {
    return !!this.offer?.founderOfferAvailable;
  }

  protected get founderSoldOut(): boolean {
    return !!this.offer?.founderSoldOut;
  }

  protected get founderCapacity(): number {
    return this.offer?.capacity ?? 0;
  }

  protected get founderClaimed(): number {
    return this.offer?.claimed ?? 0;
  }

  protected get founderLimitNote(): string {
    return this.offer?.founderLimitNote ?? '';
  }

  protected get claimedCountVisible(): boolean {
    return CLAIMED_COUNT_VISIBLE && this.founderOfferAvailable;
  }

  protected get paidTierLabel(): string {
    return this.offer?.tierLabel ?? 'Premium';
  }

  protected get paidPrice(): number | null {
    return this.offer?.priceFor(this.billingPeriod) ?? null;
  }

  // The price that no longer applies, in muted ink at body size, so it never reads as something
  // still selectable.
  protected get struckPrice(): number | null {
    return this.offer?.struckPriceFor(this.billingPeriod) ?? null;
  }

  protected get cadenceNotes(): string[] {
    return this.offer?.cadenceNotes(this.billingPeriod) ?? [];
  }

  protected get pricePeriodLabel(): string {
    return periodLabel(this.billingPeriod);
  }

  protected get paidButtonText(): string {
    if (this.paidLoading$.value) {
      return 'Opening checkout…';
    }
    if (this.premium) {
      return 'Manage subscription';
    }
    return this.offer?.ctaLabel ?? 'Go Premium';
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

    this.planService.subscribeToPlan(this.offer?.planId(this.billingPeriod) ?? '', this.founderOfferAvailable)
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
