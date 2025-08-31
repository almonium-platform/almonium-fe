import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {SettingsTabsComponent} from "../tabs/settings-tabs.component";
import {UserInfoService} from "../../../services/user-info.service";
import {PlanType, UserInfo} from "../../../models/userinfo.model";
import {NgStyle} from "@angular/common";
import {InteractiveCtaButtonComponent} from "../../../shared/interactive-cta-button/interactive-cta-button.component";
import {PopupTemplateStateService} from "../../../shared/modals/popup-template/popup-template-state.service";
import {BehaviorSubject, firstValueFrom, Subject, takeUntil} from "rxjs";
import {PaywallComponent} from "../../../shared/paywall/paywall.component";
import {PlanService} from "../../../services/plan.service";
import {TuiAlertService, TuiAutoColorPipe, TuiHintDirective} from "@taiga-ui/core";
import {ConfirmModalComponent} from "../../../shared/modals/confirm-modal/confirm-modal.component";
import {RecentAuthGuardService} from "../../../authentication/auth/recent-auth-guard.service";
import {ActivatedRoute} from "@angular/router";
import {UrlService} from "../../../services/url.service";
import {RecentAuthGuardComponent} from "../../../shared/recent-auth-guard/recent-auth-guard.component";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {UsernameComponent} from "../../../shared/username/username.component";
import {AvatarSettingsComponent} from "../../../shared/avatar/settings/avatar-settings.component";
import {InterestsComponent} from "../../../shared/interests/interests.component";
import {TuiChip} from "@taiga-ui/kit";
import {Interest} from "../../../shared/interests/interest.model";
import {ProfileSettingsService} from "./profile-settings.service";
import {ButtonComponent} from "../../../shared/button/button.component";
import {ShareLinkComponent} from "../../../shared/share-link/share-link.component";
import {SharedLucideIconsModule} from "../../../shared/shared-lucide-icons.module";

@Component({
  selector: 'app-profile-settings',
  imports: [
    SettingsTabsComponent,
    InteractiveCtaButtonComponent,
    PaywallComponent,
    ConfirmModalComponent,
    TuiHintDirective,
    NgStyle,
    RecentAuthGuardComponent,
    ReactiveFormsModule,
    UsernameComponent,
    AvatarSettingsComponent,
    InterestsComponent,
    TuiAutoColorPipe,
    TuiChip,
    ButtonComponent,
    ShareLinkComponent,
    FormsModule,
    SharedLucideIconsModule,
  ],
  templateUrl: './profile-settings.component.html',
  styleUrl: './profile-settings.component.less'
})
export class ProfileSettingsComponent implements OnInit, OnDestroy {
  @ViewChild(PaywallComponent, {static: true}) paywallComponent!: PaywallComponent;
  @ViewChild(ShareLinkComponent, {static: false}) shareLinkComponent!: ShareLinkComponent;

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

  // features
  protected premiumFeatures: string[] = [
    "Unlimited stories",
    "Unlimited reviews",
    "Multiple languages",
    "Card rephrasing",
    "All the books",
    "All the games",
  ];

  private currentFeatureIndex = Math.floor(Math.random() * this.premiumFeatures.length);
  protected displayedFeature = this.premiumFeatures[this.currentFeatureIndex];
  private featureRotationInterval: any;

  // interests
  protected interestsEdit: boolean = false;
  protected interests: Interest[] = [];

  private readonly loadingSubjectInterests$ = new BehaviorSubject<boolean>(false);
  protected readonly loadingInterests$ = this.loadingSubjectInterests$.asObservable();

  private readonly loadingSubjectCustomerPortal$ = new BehaviorSubject<boolean>(false);
  protected readonly loadingCustomerPortal$ = this.loadingSubjectCustomerPortal$.asObservable();

  private readonly loadingSubjectHideProfile$ = new BehaviorSubject<boolean>(false);
  protected readonly loadingHideProfile$ = this.loadingSubjectHideProfile$.asObservable();

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
      if (!this.premium) {
        this.startFeatureRotation();
      }
      this.interests = info.interests;
      this.setRenewalTooltip(info);
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    clearInterval(this.featureRotationInterval);
  }

  private startFeatureRotation() {
    this.featureRotationInterval = setInterval(() => {
      this.currentFeatureIndex = (this.currentFeatureIndex + 1) % this.premiumFeatures.length;
      this.displayedFeature = this.premiumFeatures[this.currentFeatureIndex];
    }, 2000);
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
    this.popupTemplateStateService.open(this.paywallComponent.content, 'paywall');
  }

  protected accessCustomerPortal() {
    this.loadingSubjectCustomerPortal$.next(true);

    this.planService.accessCustomerPortal().subscribe((url) => {
      this.loadingSubjectCustomerPortal$.next(false);
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
      console.info('no changes');
      return;
    }

    // Start loading
    this.loadingSubjectInterests$.next(true);

    try {
      await firstValueFrom(
        this.profileSettingsService.saveInterests(this.interests.map((i) => i.id))
      );

      this.interestsEdit = false;
      this.userInfoService.updateUserInfo({interests: this.interests});
      this.alertService
        .open('Interests updated', {appearance: 'success'})
        .subscribe();
    } catch (error) {
      this.alertService
        .open('Failed to update interests', {appearance: 'error'})
        .subscribe();
    } finally {
      this.loadingSubjectInterests$.next(false);
    }
  }

  protected onSelectedInterestsChange(interests: Interest[]) {
    this.interests = interests;
  }

  protected validateInterests() {
    return true;
  }

  protected openShareProfile() {
    this.popupTemplateStateService.open(this.shareLinkComponent.content, 'share-link');
  }

  protected copyProfileLink() {
    const link = this.getProfileLink();
    navigator.clipboard.writeText(link).then(
      () => {
        this.alertService.open('Link copied to clipboard', {appearance: 'neutral'}).subscribe();
      },
      (err) => {
        console.error('Failed to copy: ', err);
      }
    );
  }

  protected getProfileLink() {
    return 'almonium.com/users/' + this.userInfo?.id;
  }

  protected toggleHidden(): void {
    const toggleValue = !this.userInfo?.hidden;
    if (!this.userInfo || this.userInfo.hidden === undefined) {
      return; // Exit early if userInfo is not set
    }

    const oldValue = this.userInfo.hidden;
    this.userInfo.hidden = toggleValue; // Optimistic update

    this.profileSettingsService.toggleHidden(toggleValue).subscribe({
      next: () => {
        this.userInfoService.updateUserInfo({hidden: toggleValue}); // Update cache on success
      },
      error: (error) => {
        if (this.userInfo) {
          this.userInfo.hidden = oldValue;
        }
        console.error('Failed to save preferences:', error);
        this.alertService.open('Failed to save preferences', {appearance: 'error'}).subscribe();
      },
    });
  }
}
