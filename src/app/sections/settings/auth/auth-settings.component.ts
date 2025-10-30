import {ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {AsyncPipe, NgClass, NgTemplateOutlet} from "@angular/common";
import {ConfirmModalComponent} from "../../../shared/modals/confirm-modal/confirm-modal.component";
import {AuthSettingsService} from "./auth-settings.service";
import {TuiAlertService, TuiError, TuiIcon, TuiTextfield, TuiTextfieldComponent} from "@taiga-ui/core";
import {ActivatedRoute, Router} from "@angular/router";
import {UserInfoService} from "../../../services/user-info.service";
import {AppConstants} from "../../../app.constants";
import {AuthComponent} from "../../../authentication/auth/auth.component";
import {FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import {TUI_VALIDATION_ERRORS, TuiFieldErrorPipe} from "@taiga-ui/kit";
import {UserInfo} from "../../../models/userinfo.model";
import {AuthService} from "../../../authentication/auth/auth.service";
import {UrlService} from "../../../services/url.service";
import {EditButtonComponent} from "../../../shared/edit-button/edit-button.component";
import {ProviderIconComponent} from "../../../shared/modals/elements/provider-icon/provider-icon.component";
import {AuthMethod, TokenInfo} from "../../../authentication/auth/auth.types";
import {ActionModalComponent} from "../../../shared/modals/action-modal/action-modal.component";
import {RecentAuthGuardService} from "../../../authentication/auth/recent-auth-guard.service";
import {SettingsTabsComponent} from "../tabs/settings-tabs.component";
import {LocalStorageService} from "../../../services/local-storage.service";
import {RecentAuthGuardComponent} from "../../../shared/recent-auth-guard/recent-auth-guard.component";
import {BehaviorSubject, filter, finalize, Subject, takeUntil} from "rxjs";
import {PopupTemplateStateService} from "../../../shared/modals/popup-template/popup-template-state.service";
import {ButtonComponent} from "../../../shared/button/button.component";

@Component({
  selector: 'app-settings',
  imports: [
    ConfirmModalComponent,
    NgTemplateOutlet,
    AuthComponent,
    NgClass,
    AsyncPipe,
    ReactiveFormsModule,
    TuiError,
    TuiFieldErrorPipe,
    EditButtonComponent,
    ProviderIconComponent,
    ActionModalComponent,
    SettingsTabsComponent,
    TuiIcon,
    RecentAuthGuardComponent,
    TuiTextfieldComponent,
    FormsModule,
    TuiTextfield,
    ButtonComponent
  ],
  templateUrl: './auth-settings.component.html',
  providers: [
    {
      provide: TUI_VALIDATION_ERRORS,
      useValue: {
        required: 'Value is required',
        email: 'Invalid email address',
        minlength: ({requiredLength, actualLength}: {
          requiredLength: number;
          actualLength: number;
        }) => `Password is too short: ${actualLength}/${requiredLength} characters`,
      },
    },
  ],
  styleUrls: ['./auth-settings.component.less']
})
export class AuthSettingsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // populated in ngOnInit
  protected userInfo: UserInfo | null = null;
  protected authMethods: AuthMethod[] = [];
  protected authProviders: string[] = [];

  // email and password settings
  protected emailVerifiedTextExpanded = true;
  protected emailEditable: boolean = false;
  protected passwordEditable: boolean = false;
  protected lastPasswordUpdate: string = '';
  protected emailVerified: boolean = true;
  protected emailForm = new FormGroup({
    emailValue: new FormControl<string>('', {
      validators: [Validators.required, Validators.email],
      nonNullable: true,
    }),
  });
  private readonly passwordPlaceholder = '********';

  protected passwordForm = new FormGroup({
    passwordValue: new FormControl(this.passwordPlaceholder, {
      validators: [Validators.required, Validators.minLength(AppConstants.MIN_PASSWORD_LENGTH)],
      nonNullable: true,
    }),
  });

  @ViewChild('passwordField') passwordField!: TuiTextfieldComponent<string>;
  @ViewChild('emailField') emailField!: TuiTextfieldComponent<string>;
  @ViewChild(AuthComponent, {static: false}) authComponent!: AuthComponent;

  // Provider info modal
  protected providerInfoVisible: boolean = false;
  protected providerInfoTitle: string = '';
  protected providerInfoText: string = '';
  protected providerInfoIcon: string = '';

  // email token settings
  protected tokenInfo: TokenInfo | null = null;
  protected isEmailTokenModalVisible: boolean = false;

  // auth modal settings
  protected authMode: 'embedded' | 'linkLocal' | 'changeEmail' = 'embedded';
  protected isAuthModalVisible: boolean = false;

  // confirm modal settings
  protected isConfirmModalVisible: boolean = false;
  protected modalTitle = '';
  protected modalMessage = '';
  protected modalConfirmText = '';
  protected modalAction: (() => void) | null = null;
  protected useCountdown: boolean = false;


  private readonly loadingSubjectEmail$ = new BehaviorSubject<boolean>(false);
  protected readonly loadingEmail$ = this.loadingSubjectEmail$.asObservable();

  private readonly loadingSubjectPassword$ = new BehaviorSubject<boolean>(false);
  protected readonly loadingPassword$ = this.loadingSubjectPassword$.asObservable();


  constructor(
    private settingService: AuthSettingsService,
    private alertService: TuiAlertService,
    private userInfoService: UserInfoService,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private urlService: UrlService,
    private recentAuthGuardService: RecentAuthGuardService,
    private localStorageService: LocalStorageService,
    private popupTemplateStateService: PopupTemplateStateService,
    private cdr: ChangeDetectorRef,
  ) {
  }


  ngOnInit(): void {
    this.displayAppropriateAlerts();
    this.populateAuthMethods();
    this.getUserInfo();
    this.populateLastToken();
    this.listenToPopupClose();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private displayAppropriateAlerts() {
    this.route.queryParams.subscribe(params => {
      if (params['error']) {
        this.alertService.open(params['error'], {appearance: 'error'}).subscribe();
        this.urlService.clearUrl();
      } else {
        if (params['intent'] === 'link') {
          this.alertService.open('Account successfully linked!', {appearance: 'success'}).subscribe();
          this.urlService.clearUrl();
        }
        if (params['intent'] === 'reauth') {
          this.recentAuthGuardService.updateStatusAndShowAlert();
          this.urlService.clearUrl();
        }
      }
    });
  }

  private populateAuthMethods() {
    this.settingService.populateAuthMethods().subscribe({
      next: (methods) => {
        this.authMethods = methods;
        this.authProviders = methods.map(method => method.provider);
        this.updateLocalAuthData(methods);
      },
      error: (error) => {
        console.error(error);
        this.alertService.open(error.error.message || 'Failed to get auth methods', {appearance: 'error'}).subscribe();
      },
    });
  }

  private updateLocalAuthData(methods: AuthMethod[]): void {
    if (this.isProviderLinked('local')) {
      const localMethod = methods.find(method => method.provider.toLowerCase() === 'local')!;
      this.lastPasswordUpdate = localMethod.lastPasswordResetDate
        ? new Date(localMethod.lastPasswordResetDate).toISOString().split('T')[0]
        : new Date(localMethod.createdAt).toISOString().split('T')[0];
    }
  }

  private clearAuthCache(): void {
    this.localStorageService.clearAuthMethods();
  }

  private getUserInfo() {
    this.userInfoService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe((info) => {
      this.userInfo = info;
      if (info) {
        this.emailForm.get('emailValue')?.setValue(info.email);
        this.emailVerified = info.emailVerified;
      }
    });
  }


  // CONFIRMATION MODAL
  protected confirmModalAction() {
    if (this.modalAction) {
      this.modalAction();
    }
    this.closeConfirmModal();
  }

  protected closeConfirmModal() {
    this.isConfirmModalVisible = false;
  }

  // DELETE ACCOUNT
  protected onDeleteAccount() {
    this.restoreEmailAndPasswordFields();
    this.checkAuth(this.prepareConfirmModalForDeletion.bind(this));
  }

  private prepareConfirmModalForDeletion() {
    this.modalTitle = 'Delete Account';
    this.modalMessage = 'Are you sure? This action cannot be undone';
    this.modalConfirmText = 'Delete Account';
    this.modalAction = this.confirmDeletion.bind(this);
    this.useCountdown = true;
    this.isConfirmModalVisible = true;
  }

  private confirmDeletion() {
    this.settingService.deleteAccount().subscribe({
      next: () => {  // No response body expected for 204
        this.alertService.open('Account successfully deleted!', {appearance: 'success'}).subscribe();
        this.localStorageService.clearUserRelatedData();
        this.router.navigate(['/auth'], {fragment: 'sign-in'}).then();
      },
      error: (error) => {
        this.alertService
          .open(error.error.message || 'Failed to delete account', {appearance: 'error'})
          .subscribe();
      },
    });
  }

  // AUTH PROVIDERS BLOCKS

  // Provider info modal
  protected prepareAndShowProviderModal = (provider: string) => {
    this.providerInfoText = this.getProviderInfo(provider);
    this.providerInfoTitle = this.getFormattedProvider(provider) + " Info";
    this.providerInfoIcon = [
      provider === 'local' ? 'fas' : 'fab',
      provider === 'local' ? 'fa-envelope' : 'fa-' + provider.toLowerCase()
    ].join(' ') + ' text-lg';
    this.providerInfoVisible = true;
  }

  protected closeProviderInfo() {
    this.providerInfoVisible = false;
  }

  protected getProviderInfo = (provider: string) => {
    let method = this.authMethods
      .filter(method => method.provider.toLowerCase() === provider.toLowerCase())
      .pop();

    if (method) {
      return `
      <div>
        <p class="text-gray-700 mb-2 text-sm"><strong>Email:</strong> ${method.email}</p>
        <p class="text-gray-700 mb-2 text-sm"><strong>Connected At:</strong> ${this.getFormattedDate(method.createdAt)}</p>
        <p class="text-gray-700 mb-2 text-sm"><strong>Updated At:</strong> ${(this.getFormattedDate(method.updatedAt))}</p>
      </div>
    `;
    }
    return 'No info available';
  }

  private getFormattedDate(date: string) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

// Linking and unlinking social accounts

  // boolean checkers
  protected isProviderLinked(provider: string): boolean {
    return this.authMethods.some(method => method.provider.toLowerCase() === provider.toLowerCase());
  }

  protected isLastLinkedProvider(provider: string): boolean {
    return this.authMethods.length === 1 && this.isProviderLinked(provider);
  }

  protected handleProviderWrapped = (provider: string) => () => {
    this.restoreEmailAndPasswordFields();
    this.checkAuth(() => this.universalProviderHandler(provider));
  }

  private universalProviderHandler(provider: string) {
    if (!this.isProviderLinked(provider)) {
      this.linkAuthMethod(provider);
      return
    }
    this.prepareUnlinkConfirmationModal(provider);
  }

  private linkAuthMethod(provider: string) {
    this.clearAuthCache();

    if (provider === 'local') {
      this.authMode = 'linkLocal';
      this.openAuthModal();
      return;
    }
    const providerUrls: { [key: string]: string } = {
      google: AppConstants.GOOGLE_AUTH_URL_WITH_REDIRECT_TO,
      apple: AppConstants.APPLE_AUTH_URL_WITH_REDIRECT_TO,
    };
    window.location.href = providerUrls[provider] + '/settings/auth&intent=link';
  }

  private prepareUnlinkConfirmationModal(provider: string) {
    this.modalTitle = 'Unlink account';
    this.modalMessage = `Are you sure you want to unlink your ${this.getFormattedProvider(provider)} account?`;
    this.modalConfirmText = 'Unlink';
    this.modalAction = () => this.unlinkAuthMethod(provider);
    this.isConfirmModalVisible = true;
  }

  private unlinkAuthMethod(provider: string) {
    this.clearAuthCache();

    this.settingService.unlinkAuthProvider(provider).subscribe({
      next: (reauthRequired: boolean) => {
        this.alertService.open(`${this.getFormattedProvider(provider)} account successfully unlinked!`, {appearance: 'success'}).subscribe();
        this.authMethods = this.authMethods.filter(method => method.provider.toLowerCase() !== provider.toLowerCase());
        if (reauthRequired) {
          this.alertService.open('Since you used this account to sign in, you will be logged out in 2 seconds.', {appearance: 'info'}).subscribe();
          setTimeout(() => {
            this.userInfoService.clearUserInfo();
            this.authService.logoutPublic().subscribe();
            this.router.navigate(['/auth'], {fragment: 'sign-in'}).then();
          }, 2000);
        } else {
        }
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Failed to unlink account', {appearance: 'error'}).subscribe();
      },
    });
  }

  // AUTH MODAL
  private listenToPopupClose() {
    this.popupTemplateStateService.drawerState$
      .pipe(
        takeUntil(this.destroy$),
        filter((state) => state.type === 'auth' && !state.visible)
      )
      .subscribe(() => {
        if (this.isAuthModalVisible) {
          this.isAuthModalVisible = false;
          this.cdr.detectChanges();
          this.populateAuthMethods();
        }
      });
  }

  private openAuthModal() {
    this.isAuthModalVisible = true;

    setTimeout(() => {
      if (this.authComponent) {
        this.popupTemplateStateService.open(this.authComponent.content, 'auth', true);
      }
    });
  }

  // universal live token auth guard
  private checkAuth(onValidToken: () => void) {
    this.recentAuthGuardService.guardAction(onValidToken);
  }

  // PENDING EMAIL CHANGE REQUEST
  protected getEmailTokenMessage() {
    return `
      Your email <strong>${this.tokenInfo?.email}</strong> is pending verification.
      Request will expire in <strong>${this.countMinutesLeft()}</strong> minutes.
      `;
  }

  private countMinutesLeft(): number {
    return Math.floor((this.tokenInfo?.expiresAt.getTime()! - new Date().getTime()) / 60000);
  }

  protected closeEmailTokenModal() {
    this.isEmailTokenModalVisible = false;
  }

  protected onPendingEmailVerificationClick() {
    this.checkAuth(() => this.isEmailTokenModalVisible = true);
  }

  private populateLastToken() {
    this.settingService.getLastEmailVerificationToken().subscribe({
      next: (token) => {
        if (!token) {
          this.tokenInfo = null;
          return;
        }
        this.tokenInfo = {
          ...token,
          expiresAt: new Date(token.expiresAt),
        };
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Failed to get last token', {appearance: 'error'}).subscribe();
        console.error('Error getting last token:', error);
      },
    });
  }

  protected hasPendingEmailVerificationRequest(): boolean {
    return !!this.tokenInfo;
  }

  protected cancelEmailChangeRequest() {
    this.checkAuth(() => {
    })

    this.settingService.cancelEmailVerificationRequest().subscribe({
      next: () => {
        this.alertService.open('Email verification request cancelled!', {appearance: 'success'}).subscribe();
        this.populateLastToken();
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Failed to cancel email verification request', {appearance: 'error'}).subscribe();
        console.error('Error cancelling email verification request:', error);
      },
    });
  }

  protected resendEmailChangeRequest() {
    this.checkAuth(() => {
    })

    this.settingService.resendEmailVerificationRequest().subscribe({
      next: () => {
        this.alertService.open('Email verification request resent!', {appearance: 'success'}).subscribe();
        this.populateLastToken();
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Failed to resend email verification request', {appearance: 'error'}).subscribe();
        console.error('Error resending email verification request:', error);
      },
    });
  }

  // EMAIL AND PASSWORD SETTINGS
  @HostListener('document:keydown.escape', ['$event'])
  protected onEscape() {
    this.restoreEmailAndPasswordFields();
  }

  protected onPasswordEditClick() {
    this.restoreEmailField();
    this.checkAuth(this.passwordSubmit.bind(this));
  }

  private passwordSubmit() {
    this.focusPasswordInput();

    if (!this.passwordEditable) {
      this.passwordEditable = true;
      this.passwordForm.setValue({passwordValue: ''});
      return;
    }

    if (!this.passwordForm.valid) {
      this.alertService.open('Please enter a valid password', {appearance: 'error'}).subscribe();
      return;
    }

    this.checkAuth(() => this.changePassword());
  }

  protected requestEmailVerification() {
    if (!this.isProviderLinked('local')) {
      this.alertService.open('To verify your email, you need to link a local account first', {appearance: 'info'}).subscribe();
      this.authMode = 'linkLocal';
      this.openAuthModal();
      return;
    }

    this.settingService.requestEmailVerification().subscribe({
      next: () => {
        this.alertService.open('Verification email sent!', {appearance: 'success'}).subscribe();
        this.populateLastToken();
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Failed to send verification email', {appearance: 'error'}).subscribe();
      },
    });
  }

  protected emailConfirmEnabled(): boolean {
    if (!this.emailEditable) {
      return true;
    }
    return this.emailForm.valid && this.getEmailFieldValue() !== this.userInfo?.email;
  }

  protected passwordConfirmEnabled(): boolean {
    if (!this.passwordEditable) {
      return true;
    }
    return this.passwordForm.valid;
  }

  private restorePasswordField() {
    this.passwordEditable = false;
    this.passwordForm.setValue({passwordValue: this.passwordPlaceholder});
    this.passwordForm.get('passwordValue')?.setErrors(null);
  }

  private restoreEmailField() {
    if (this.emailEditable) {
      this.emailEditable = false;
      this.emailForm.setValue({emailValue: this.userInfo?.email!});
      this.emailForm.get('emailValue')?.setErrors(null);
      this.emailVerifiedTextExpanded = true;
    }
  }

  protected onEmailEditClick() {
    this.restorePasswordField();
    this.focusEmailInput();
    if (this.hasPendingEmailVerificationRequest()) {
      console.error('This button should not be visible');
      return;
    }

    this.checkAuth(() => this.onEmailChange());
  }

  private onEmailChange() {
    this.focusEmailInput();

    if (!this.isProviderLinked('local')) {
      this.authMode = 'changeEmail';
      this.openAuthModal();
      return;
    }

    if (!this.emailEditable) {
      this.emailEditable = true;
      this.emailVerifiedTextExpanded = false;
      return;
    }

    if (!this.emailForm.valid) {
      this.alertService.open('Please enter a valid email address', {appearance: 'error'}).subscribe();
      return;
    }

    if (this.emailChanged()) {
      this.alertService.open('No changes detected in the email address', {appearance: 'info'}).subscribe();
      return;
    }

    this.checkAuth(() => this.checkAndChangeEmail());
  }

  private emailChanged() {
    const currentEmail = this.getEmailFieldValue();
    const initialEmail = this.userInfo?.email;
    return currentEmail === initialEmail;
  }

  private changePassword() {
    this.clearAuthCache();

    this.loadingSubjectPassword$.next(true);

    this.settingService.changePassword(this.getPasswordFieldValue())
      .pipe(finalize(() => this.loadingSubjectPassword$.next(false)))
      .subscribe({
        next: () => {
          this.alertService.open('Password successfully changed!', {appearance: 'success'}).subscribe();
          this.lastPasswordUpdate = new Date().toISOString().split('T')[0];
          this.restorePasswordField();
        },
        error: (error) => {
          this.alertService.open(error.error.message || 'Failed to change password', {appearance: 'error'}).subscribe();
        },
      });
  }

  private checkAndChangeEmail() {
    this.loadingSubjectEmail$.next(true);

    this.settingService.isEmailAvailable(this.getEmailFieldValue())
      .pipe(finalize(() => this.loadingSubjectEmail$.next(false)))
      .subscribe({
        next: (isAvailable) => {
          if (!isAvailable) {
            this.alertService.open('Email is already in use', {appearance: 'error'}).subscribe();
            return;
          }

          if (this.isProviderLinked('local')) {
            this.sendEmailChangeRequest();
          }
          this.restoreEmailField();
        },
        error: (error) => {
          this.alertService.open(error.error.message || 'Failed to check email availability', {appearance: 'error'}).subscribe();
          console.error('Error checking email availability:', error);
        },
      });
  }

  private sendEmailChangeRequest() {
    this.settingService.requestEmailChange(this.getEmailFieldValue()).subscribe({
      next: () => {
        this.alertService.open('Email change request sent!', {appearance: 'success'}).subscribe();
        this.emailForm.setValue({emailValue: this.userInfo?.email!});
        this.populateAuthMethods();
        this.populateLastToken();
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Failed to send email change request', {appearance: 'error'}).subscribe();
        console.error('Error sending email change request:', error);
      }
    });
  }

  private getEmailFieldValue() {
    return this.emailForm.get('emailValue')?.value?.toString().trim()!;
  }

  private getPasswordFieldValue() {
    return this.passwordForm.get('passwordValue')?.value?.toString().trim()!;
  }

  private focusPasswordInput() {
    if (this.passwordField) {
      this.passwordField.input?.nativeElement.focus();
    }
  }

  private focusEmailInput() {
    if (this.emailField) {
      this.emailField.input?.nativeElement.focus();
    }
  }

  private restoreEmailAndPasswordFields() {
    this.restoreEmailField();
    this.restorePasswordField();
  }


  // utility function
  private getFormattedProvider(provider: string) {
    return provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase();
  }
}
