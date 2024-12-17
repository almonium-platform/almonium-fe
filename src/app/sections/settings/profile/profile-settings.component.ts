import {ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {NavbarComponent} from "../../../shared/navbars/navbar/navbar.component";
import {SettingsTabsComponent} from "../tabs/settings-tabs.component";
import {UserInfoService} from "../../../services/user-info.service";
import {PlanType, UserInfo} from "../../../models/userinfo.model";
import {AsyncPipe, NgClass, NgIf, NgStyle} from "@angular/common";
import {InteractiveCtaButtonComponent} from "../../../shared/interactive-cta-button/interactive-cta-button.component";
import {PopupTemplateStateService} from "../../../shared/modals/popup-template/popup-template-state.service";
import {Observable, of, Subject, takeUntil, timer} from "rxjs";
import {PaywallComponent} from "../../../shared/paywall/paywall.component";
import {PlanService} from "../../../services/plan.service";
import {
  TuiAlertService,
  TuiError,
  TuiHintDirective,
  TuiIcon,
  TuiTextfieldComponent,
  TuiTextfieldDirective,
  TuiTextfieldOptionsDirective
} from "@taiga-ui/core";
import {LucideAngularModule} from "lucide-angular";
import {ConfirmModalComponent} from "../../../shared/modals/confirm-modal/confirm-modal.component";
import {RecentAuthGuardService} from "../auth/recent-auth-guard.service";
import {ActivatedRoute} from "@angular/router";
import {UrlService} from "../../../services/url.service";
import {RecentAuthGuardComponent} from "../../../shared/recent-auth-guard/recent-auth-guard.component";
import {
  AbstractControl,
  AsyncValidatorFn,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from "@angular/forms";
import {ProfilePictureComponent} from "../../../shared/avatar/profile-picture.component";
import {
  TUI_VALIDATION_ERRORS,
  TuiBadge,
  TuiBadgedContent,
  TuiBadgedContentComponent,
  TuiFieldErrorPipe
} from "@taiga-ui/kit";
import {ManageAvatarComponent} from "./avatar/manage-avatar/manage-avatar.component";
import {TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {AppConstants} from "../../../app.constants";
import {ProfileSettingsService} from "./profile-settings.service";
import {EditButtonComponent} from "../../../shared/edit-button/edit-button.component";
import {catchError, debounceTime, distinctUntilChanged, map, switchMap} from "rxjs/operators";

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
    ProfilePictureComponent,
    TuiBadgedContentComponent,
    TuiBadgedContent,
    TuiIcon,
    TuiBadge,
    ManageAvatarComponent,
    TuiError,
    TuiTextfieldComponent,
    TuiTextfieldControllerModule,
    TuiTextfieldDirective,
    TuiTextfieldOptionsDirective,
    EditButtonComponent,
    NgClass,
    AsyncPipe,
    TuiFieldErrorPipe,

  ],
  providers: [
    {
      provide: TUI_VALIDATION_ERRORS,
      useValue: {
        required: 'Value is required',
        minlength: ({requiredLength, actualLength}: {
          requiredLength: number;
          actualLength: number;
        }) => `Too short: ${actualLength}/${requiredLength} characters`,
        maxlength: ({requiredLength, actualLength}: {
          requiredLength: number;
          actualLength: number;
        }) => `Too long: ${actualLength}/${requiredLength} characters`,
        pattern: 'Use only digits, lowercase Latin letters, and underscores',
        usernameTaken: 'Username is already taken',
        serverError: 'Server error',
        unchanged: 'No changes'
      }
    },
  ],
  templateUrl: './profile-settings.component.html',
  styleUrl: './profile-settings.component.less'
})
export class ProfileSettingsComponent implements OnInit, OnDestroy {
  @ViewChild(PaywallComponent, {static: true}) paywallComponent!: PaywallComponent;
  @ViewChild(ManageAvatarComponent, {static: true}) uploadAvatarComponent!: ManageAvatarComponent;

  private destroy$ = new Subject<void>();

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

  // username
  protected usernameEditable: boolean = false;
  @ViewChild('username') usernameField!: TuiTextfieldComponent<string>;
  protected isLoading: boolean = false;
  protected usernameForm: FormGroup;
  protected tooltipUsername: string = `Requirements:
• ${AppConstants.MIN_USERNAME_LENGTH}-${AppConstants.MAX_USERNAME_LENGTH} characters,
• lowercase Latin letters,
• underscores, digits.
`;

  constructor(
    private userInfoService: UserInfoService,
    private popupTemplateStateService: PopupTemplateStateService,
    private planService: PlanService,
    private recentAuthGuardService: RecentAuthGuardService,
    private activatedRoute: ActivatedRoute,
    private urlService: UrlService,
    private alertService: TuiAlertService,
    private profileSettingsService: ProfileSettingsService,
    private cdr: ChangeDetectorRef,
  ) {
    this.usernameForm = new FormGroup({
      usernameValue: new FormControl('', {
        validators: [
          Validators.required,
          Validators.minLength(AppConstants.MIN_USERNAME_LENGTH),
          Validators.maxLength(AppConstants.MAX_USERNAME_LENGTH),
          Validators.pattern(AppConstants.USERNAME_PATTERN),
          this.usernameChangedValidator(),
        ],
        nonNullable: true,
      }),
    });
    this.usernameForm.get('usernameValue')?.setAsyncValidators(this.usernameAvailableAsyncValidator());

    // Track loading state
    this.usernameForm.get('usernameValue')?.statusChanges.subscribe((status) => {
      this.isLoading = status === 'PENDING';
      this.cdr.markForCheck();
    });
  }

  ngOnInit() {
    this.dealWithQueryParams();

    this.userInfoService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe(info => {
      if (!info) {
        return;
      }
      this.userInfo = info;
      this.premium = info.premium;
      this.setRenewalTooltip(info);
      this.usernameForm.get('usernameValue')?.setValue(info.username);
      this.keepUsernameFieldClean();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private keepUsernameFieldClean(): void {
    this.usernameForm
      .get('usernameValue')
      ?.valueChanges.pipe(
      debounceTime(800),
      distinctUntilChanged(),
      map((value: string) => value.toLowerCase().replace(/\s/g, '')), // Convert to lowercase and remove spaces
      takeUntil(this.destroy$) // Unsubscribe when destroy$ emits
    )
      .subscribe((transformedValue: string) => {
        const currentValue = this.usernameForm.get('usernameValue')?.value;
        if (transformedValue !== currentValue) {
          this.usernameForm.get('usernameValue')?.setValue(transformedValue, {emitEvent: false});
        }
      });
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
    this.activatedRoute.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
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

  protected changeAvatar() {
    this.popupTemplateStateService.open(this.uploadAvatarComponent.content);
  }


  // username
  protected onUsernameEditClick() {
    if (this.usernameEditable) {
      this.updateUsername();
      return;
    }
    this.usernameEditable = true;
    this.cdr.detectChanges();
    if (this.usernameField) {
      this.usernameField.input?.nativeElement.focus();
    }
  }

  private updateUsername() {
    if (this.usernameForm.invalid) {
      return;
    }

    const username = this.usernameForm.get('usernameValue')?.value!;
    this.profileSettingsService.updateUsername(username).subscribe({
      next: () => {
        this.alertService.open('Username updated', {appearance: 'success'}).subscribe();
        this.userInfoService.updateUserInfo({username: username});
        this.usernameEditable = false;
      },
      error: () => {
        this.alertService.open('Failed to update username', {appearance: 'error'}).subscribe();
      }
    });
  }


  // validators
  private usernameChangedValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const currentUsername = this.userInfo?.username ?? null;
      if (!this.usernameEditable) {
        return null;
      }
      if (control.value === currentUsername) {
        return {unchanged: 'No changes'};
      }
      return null;
    };
  }

  private usernameAvailableAsyncValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value) {
        return of(null); // No need to validate empty value
      }

      // Start a timer to debounce the input
      return timer(500).pipe(
        switchMap(() =>
          this.profileSettingsService.checkUsernameAvailability(control.value).pipe(
            map(response => (response.available ? null : {usernameTaken: true})),
            catchError(() => of({serverError: true}))
          )
        )
      );
    };
  }
}
