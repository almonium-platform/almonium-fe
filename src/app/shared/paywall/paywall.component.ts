import {Component, OnDestroy, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {TuiSegmented, tuiSwitchOptionsProvider} from "@taiga-ui/kit";
import {FormsModule} from "@angular/forms";
import {TuiAlertService, TuiAppearance, TuiIcon, TuiTitle} from "@taiga-ui/core";
import {TuiCardLarge} from "@taiga-ui/layout";
import {NgClass, NgForOf} from "@angular/common";
import {InteractiveCtaButtonComponent} from "../interactive-cta-button/interactive-cta-button.component";
import {PlanService} from "../../services/plan.service";
import {UserInfoService} from "../../services/user-info.service";
import {Subject, takeUntil} from "rxjs";
import {Router} from "@angular/router";
import {getNextStep, isStepAfter, SetupStep, UserInfo} from "../../models/userinfo.model";
import {OnboardingService} from "../../onboarding/onboarding.service";

@Component({
  selector: 'paywall',
  templateUrl: './paywall.component.html',
  styleUrls: ['./paywall.component.less'],
  imports: [
    FormsModule,
    TuiAppearance,
    TuiTitle,
    TuiCardLarge,
    NgForOf,
    TuiIcon,
    TuiSegmented,
    InteractiveCtaButtonComponent,
    NgClass
  ],
  providers: [
    tuiSwitchOptionsProvider({showIcons: false, appearance: () => 'primary'}),
  ]
})
export class PaywallComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  @ViewChild('paywallContent', {static: true}) content!: TemplateRef<any>;
  private readonly step = SetupStep.PLAN;

  private userInfo: UserInfo | null = null;
  protected planChosen: boolean = false;

  protected freeFeatures: string[] = [
    'One target language',
    'One story a day',
    '100 card reviews a day',
    'Basic games',
  ];
  protected premiumFeatures: string[] = [
    'Unlimited stories',
    'Unlimited translations',
    'Unlimited reviews',
    'Card rephrasing',
    'All games',
    'All target languages',
  ];
  selectedMode: number = 0;
  premiumPrice = {
    monthly: 4.99,
    yearly: 49.99,
  };
  premiumMonthlyId: string = '';
  premiumYearlyId: string = '';

  constructor(
    private planService: PlanService,
    private userInfoService: UserInfoService,
    private onboardingService: OnboardingService,
    private alertService: TuiAlertService,
    private router: Router,
  ) {
  }

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
      console.error('User is not onboarded');
      return;
    }
    this.onboardingService.completeStep(this.step).subscribe({
      next: () => {
        this.userInfoService.updateUserInfo({setupStep: getNextStep(this.step)});
      },
      error: (error) => {
        console.error('Failed to choose free plan:', error);
        this.alertService.open(error.error.message || 'Couldn\'t choose free plan', {appearance: 'error'}).subscribe();
      }
    });
  }

  subscribeToPlan() {
    if (!this.userInfo) {
      this.router.navigate(['/auth'], {fragment: 'sign-up'}).then();
      return;
    }

    let selectedPlanId = this.selectedMode === 0 ? this.premiumMonthlyId : this.premiumYearlyId;
    this.planService.subscribeToPlan(String(selectedPlanId)).subscribe((url) => {
      window.location.href = url.sessionUrl;
    });
  }
}
