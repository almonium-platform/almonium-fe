import {logger} from "../logger";
import {getErrorMessage} from '../http-error';
import { Component, OnDestroy, OnInit, TemplateRef, ViewChild, inject } from "@angular/core";
import {TuiSegmented, tuiSwitchOptionsProvider} from "@taiga-ui/kit/components";
import {FormsModule} from "@angular/forms";
import {TuiIcon, TuiNotificationService, TuiTitle} from "@taiga-ui/core/components";
import {TuiAppearance} from "@taiga-ui/core/directives";
import {TuiCardLarge} from "@taiga-ui/layout/components";

import {InteractiveCtaButtonComponent} from "../interactive-cta-button/interactive-cta-button.component";
import {PlanService} from "../../services/plan.service";
import {UserInfoService} from "../../services/user-info.service";
import {BehaviorSubject, finalize, Subject, takeUntil} from "rxjs";
import {Router} from "@angular/router";
import {getNextStep, isStepAfter, SetupStep, UserInfo} from "../../models/userinfo.model";
import {OnboardingService} from "../../onboarding/onboarding.service";
import {ButtonComponent} from "../button/button.component";

@Component({
  selector: 'app-paywall',
  templateUrl: './paywall.component.html',
  styleUrls: ['./paywall.component.less'],
  imports: [
    FormsModule,
    TuiAppearance,
    TuiTitle,
    TuiCardLarge,
    TuiIcon,
    TuiSegmented,
    InteractiveCtaButtonComponent,
    ButtonComponent
  ],
  providers: [
    tuiSwitchOptionsProvider({showIcons: false, appearance: () => 'primary'}),
  ]
})
export class PaywallComponent implements OnInit, OnDestroy {
  private planService = inject(PlanService);
  private userInfoService = inject(UserInfoService);
  private onboardingService = inject(OnboardingService);
  private alertService = inject(TuiNotificationService);
  private router = inject(Router);

  private readonly destroy$ = new Subject<void>();
  @ViewChild('paywallContent', {static: true}) content!: TemplateRef<unknown>;
  private readonly step = SetupStep.PLAN;

  private userInfo: UserInfo | null = null;
  protected planChosen = false;

  protected freeFeatures: string[] = [
    'One target language',
    'One story a day',
    '100 card reviews a day',
    'Basic play',
  ];
  protected premiumFeatures: string[] = [
    'Unlimited stories',
    'Unlimited translations',
    'Unlimited reviews',
    'Card rephrasing',
    'All play',
    'All target languages',
  ];
  selectedMode = 0;
  premiumPrice = {
    monthly: 4.99,
    yearly: 49.99,
  };
  premiumMonthlyId = '';
  premiumYearlyId = '';

  private freeLoadingSubject$ = new BehaviorSubject(false);
  private premiumLoadingSubject$ = new BehaviorSubject(false);

  readonly freeLoading$ = this.freeLoadingSubject$.asObservable();
  readonly premiumLoading$ = this.premiumLoadingSubject$.asObservable();

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
        this.planChosen = isStepAfter(userInfo.setupStep, SetupStep.PLAN);
      });
  }

  private populatePlanInfo() {
    this.planService.getPlans().subscribe(plans => {
      const monthlyPremium = plans.find(plan => plan.type === 'MONTHLY');
      const yearlyPremium = plans.find(plan => plan.type === 'YEARLY');
      if (monthlyPremium) {
        this.premiumPrice.monthly = monthlyPremium.price;
        this.premiumMonthlyId = monthlyPremium.id;
      }
      if (yearlyPremium) {
        this.premiumPrice.yearly = yearlyPremium.price;
        this.premiumYearlyId = yearlyPremium.id;
      }
    });
  }

  get currentPricePeriod(): string {
    return this.selectedMode === 0 ? '/ month' : '/ year';
  }

  get currentPriceValue(): number {
    return this.selectedMode === 0 ? this.premiumPrice.monthly : this.premiumPrice.yearly;
  }

  getIcon(feature: string) {
    if (feature.startsWith('Unlimited')) {
      return 'infinity';
    }
    return 'check';
  }

  chooseFreePlan() {
    if (this.planChosen) {
      logger.error('User is not onboarded');
      return;
    }

    this.freeLoadingSubject$.next(true);

    this.onboardingService.completeStep(this.step)
      .pipe(finalize(() => this.freeLoadingSubject$.next(false)))
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

  subscribeToPlan() {
    if (!this.userInfo) {
      void this.router.navigate(['/auth'], {fragment: 'sign-up'}).then();
      return;
    }
    if (this.premiumLoadingSubject$.value) {
      logger.warn('Rapid clicks detected');
      return;
    }

    this.premiumLoadingSubject$.next(true);

    const selectedPlanId = this.selectedMode === 0 ? this.premiumMonthlyId : this.premiumYearlyId;
    this.planService.subscribeToPlan(String(selectedPlanId))
      .pipe(finalize(() => this.premiumLoadingSubject$.next(false)))
      .subscribe((url) => {
        if (url) {
          window.location.href = url.sessionUrl;
        }
      });
  }
}
