import {Component, ElementRef, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {TuiSegmented, tuiSwitchOptionsProvider} from "@taiga-ui/kit";
import {FormsModule} from "@angular/forms";
import {TuiAppearance, TuiIcon, TuiTitle} from "@taiga-ui/core";
import {TuiCardLarge} from "@taiga-ui/layout";
import {NgForOf} from "@angular/common";
import {InteractiveCtaButtonComponent} from "../interactive-cta-button/interactive-cta-button.component";
import {PlanService} from "../../services/plan.service";

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
    InteractiveCtaButtonComponent
  ],
  providers: [
    tuiSwitchOptionsProvider({showIcons: false, appearance: () => 'primary'}),
  ]

})
export class PaywallComponent implements OnInit {
  @ViewChild('paywallContent', {static: true}) content!: TemplateRef<any>;
  @ViewChild('cardsContainer') cardsContainer!: ElementRef;

  protected value = false;

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

  constructor(
    private planService: PlanService) {
  }

  ngOnInit() {
    this.planService.getPlans().subscribe(plans => {
      console.log(plans);
      const monthlyPremium = plans.find(plan => plan.name === 'PREMIUM' && plan.type === 'MONTHLY');
      const yearlyPremium = plans.find(plan => plan.name === 'PREMIUM' && plan.type === 'YEARLY');
      if (monthlyPremium) {
        this.premiumPrice.monthly = monthlyPremium.price;
      }
      if (yearlyPremium) {
        this.premiumPrice.yearly = yearlyPremium.price;
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
}
