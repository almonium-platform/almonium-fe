import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {NavbarComponent} from "../../../shared/navbars/navbar/navbar.component";
import {SettingsTabsComponent} from "../tabs/settings-tabs.component";
import {UserInfoService} from "../../../services/user-info.service";
import {PlanType, UserInfo} from "../../../models/userinfo.model";
import {AsyncPipe, NgClass, NgForOf, NgIf, NgStyle} from "@angular/common";
import {InteractiveCtaButtonComponent} from "../../../shared/interactive-cta-button/interactive-cta-button.component";
import {PopupTemplateStateService} from "../../../shared/modals/popup-template/popup-template-state.service";
import {BehaviorSubject, firstValueFrom, Subject, takeUntil} from "rxjs";
import {PaywallComponent} from "../../../shared/paywall/paywall.component";
import {PlanService} from "../../../services/plan.service";
import {TuiAlertService, TuiAutoColorPipe, TuiHintDirective, TuiLoader} from "@taiga-ui/core";
import {LucideAngularModule} from "lucide-angular";
import {ConfirmModalComponent} from "../../../shared/modals/confirm-modal/confirm-modal.component";
import {RecentAuthGuardService} from "../../../authentication/auth/recent-auth-guard.service";
import {ActivatedRoute} from "@angular/router";
import {UrlService} from "../../../services/url.service";
import {RecentAuthGuardComponent} from "../../../shared/recent-auth-guard/recent-auth-guard.component";
import {ReactiveFormsModule} from "@angular/forms";
import {TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {UsernameComponent} from "../../../shared/username/username.component";
import {AvatarSettingsComponent} from "../../../shared/avatar/settings/avatar-settings.component";
import {InterestsComponent} from "../../../shared/interests/interests.component";
import {TuiChip} from "@taiga-ui/kit";
import {Interest} from "../../../shared/interests/interest.model";
import {ProfileSettingsService} from "./profile-settings.service";

@Component({
  selector: 'app-profile-settings',
  imports: [
    NavbarComponent,
    SettingsTabsComponent,
    NgIf,
    InteractiveCtaButtonComponent,
    PaywallComponent,
    LucideAngularModule,
    ConfirmModalComponent,
    TuiHintDirective,
    NgStyle,
    RecentAuthGuardComponent,
    ReactiveFormsModule,
    TuiTextfieldControllerModule,
    UsernameComponent,
    AvatarSettingsComponent,
    InterestsComponent,
    NgForOf,
    TuiAutoColorPipe,
    TuiChip,
    NgClass,
    AsyncPipe,
    TuiLoader,
  ],
  templateUrl: './profile-settings.component.html',
  styleUrl: './profile-settings.component.less'
})
export class ProfileSettingsComponent implements OnInit, OnDestroy {
  @ViewChild(PaywallComponent, {static: true}) paywallComponent!: PaywallComponent;

  private readonly destroy$ = new Subject<void>();

  protected userInfo: UserInfo | null = null;
  protected premium: boolean = true;
  protected readonly PlanType = PlanType;

  // confirm modal settings
  protected isConfirmModalVisible: boolean = false;
  protected modalTitle = '';
  protected modalMessageSubCancel =
    `This will immediately cancel your subscription \
and you will lose access to premium features. \
This can be useful if you want to switch to \
a different plan. To keep access until the \
end of your billing cycle, switch off \
auto-renewal in the customer portal.`;

  protected modalMessage = '';
  protected modalConfirmText = '';
  protected modalAction: (() => void) | null = null;
  protected useCountdown: boolean = false;
  protected tooltipRenewal: string = '';

  // interests
  protected interestsEdit: boolean = false;
  protected interests: Interest[] = [];
  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();

  constructor(
    private userInfoService: UserInfoService,
    private profileSettingsService: ProfileSettingsService,
    private popupTemplateStateService: PopupTemplateStateService,
    private planService: PlanService,
    private recentAuthGuardService: RecentAuthGuardService,
    private activatedRoute: ActivatedRoute,
    private urlService: UrlService,
    private alertService: TuiAlertService,
  ) {
  }

  ngOnInit() {
    this.dealWithQueryParams();

    this.userInfoService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe(info => {
      if (!info) {
        return;
      }
      this.userInfo = info;
      this.premium = info.premium;
      this.interests = info.interests;
      this.setRenewalTooltip(info);
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setRenewalTooltip(info: UserInfo) {
    const renewalStatus = info.subscription?.autoRenewal ? 'renew' : 'end';
    const formattedDate = info.subscription?.endDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).replace(/(\d+)(?=\D*$)/, '$1');

    this.tooltipRenewal = info.subscription?.type === PlanType.LIFETIME
      ? 'Lifetime subscription 🎉'
      : `Subscription will ${renewalStatus} on ${formattedDate}`;
  }

  private dealWithQueryParams() {
    this.activatedRoute.queryParams.subscribe(params => {
      if (params['portal'] === 'from') {
        this.userInfoService.fetchUserInfoFromServer().subscribe();
        this.urlService.clearUrl();
      }
      if (params['portal'] === 'to') {
        this.accessCustomerPortal();
      }
      if (params['intent'] === 'reauth') {
        this.recentAuthGuardService.updateStatusAndShowAlert();
        this.urlService.clearUrl();
      }
    });
  }

  protected showComparePlansPopup() {
    this.popupTemplateStateService.open(this.paywallComponent.content);
  }

  protected accessCustomerPortal() {
    this.planService.accessCustomerPortal().subscribe((url) => {
      window.location.href = url.sessionUrl;
    });
  }


  // cancel subscription methods
  protected cancelSubscription() {
    this.planService.cancelSubscription().subscribe(() => {
      this.alertService.open('You\'ve been downgraded to a free account, allow some time or re-login to see the changes.', {appearance: 'success'}).subscribe();
      setTimeout(() => {
        this.userInfoService.fetchUserInfoFromServer().subscribe();
      }, 4000);
    });
  }

  // cancel sub modal methods
  protected prepareCancelSubscriptionModalWrapper() {
    this.recentAuthGuardService.guardAction(() => {
      this.prepareCancelSubscriptionModal();
    });
  }

  private prepareCancelSubscriptionModal() {
    this.modalTitle = 'Cancel Subscription';
    this.modalMessage = this.modalMessageSubCancel;
    this.modalConfirmText = 'Downgrade Now';
    this.modalAction = this.cancelSubscription;
    this.isConfirmModalVisible = true;
  }

  protected closeModal() {
    this.isConfirmModalVisible = false;
  }

  protected editInterests() {
    this.interestsEdit = true;
  }

  protected async saveInterests() {
    if (this.interests === this.userInfo?.interests) {
      this.interestsEdit = false;
      console.log('no changes');
      return;
    }

    // Start loading
    this.loadingSubject$.next(true);

    try {
      await firstValueFrom(
        this.profileSettingsService.saveInterests(this.interests.map((i) => i.id))
      );

      this.interestsEdit = false;
      this.userInfoService.updateUserInfo({interests: this.interests});
      this.alertService
        .open('Interests updated successfully', {appearance: 'success'})
        .subscribe();
    } catch (error) {
      this.alertService
        .open('Failed to update interests', {appearance: 'error'})
        .subscribe();
    } finally {
      this.loadingSubject$.next(false);
    }
  }

  onSelectedInterestsChange(interests: Interest[]) {
    this.interests = interests;
  }

  validateInterests() {
    return true;
  }
}
