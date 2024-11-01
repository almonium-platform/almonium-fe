import {Component, HostListener, OnInit, ViewChild} from '@angular/core';
import {NavbarComponent} from "../../shared/navbars/navbar/navbar.component";
import {AsyncPipe, NgClass, NgForOf, NgIf, NgOptimizedImage, NgStyle, NgTemplateOutlet} from "@angular/common";
import {NotReadyComponent} from "../../shared/not-ready/not-ready.component";
import {ConfirmModalComponent} from "../../shared/modals/confirm-modal/confirm-modal.component";
import {SettingService} from "./settings.service";
import {TuiAlertService, TuiErrorModule, TuiTextfieldControllerModule} from "@taiga-ui/core";
import {ActivatedRoute, Router} from "@angular/router";
import {UserInfoService} from "../../services/user-info.service";
import {AppConstants} from "../../app.constants";
import {AuthComponent} from "../../authentication/auth/auth.component";
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from "@angular/forms";
import {
  TUI_VALIDATION_ERRORS,
  TuiFieldErrorPipeModule,
  TuiInputComponent,
  TuiInputModule,
  TuiInputPasswordComponent,
  TuiInputPasswordModule
} from "@taiga-ui/kit";
import {UserInfo} from "../../models/userinfo.model";
import {AuthService} from "../../authentication/auth/auth.service";
import {UrlService} from "../../services/url.service";
import {EditButtonComponent} from "../../shared/edit-button/edit-button.component";
import {ProviderIconComponent} from "../../shared/modals/elements/provider-icon/provider-icon.component";

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    NavbarComponent,
    NgOptimizedImage,
    NotReadyComponent,
    NgIf,
    ConfirmModalComponent,
    NgForOf,
    NgStyle,
    NgTemplateOutlet,
    AuthComponent,
    NgClass,
    AsyncPipe,
    ReactiveFormsModule,
    TuiErrorModule,
    TuiFieldErrorPipeModule,
    TuiInputModule,
    TuiInputPasswordModule,
    TuiTextfieldControllerModule,
    EditButtonComponent,
    ProviderIconComponent
  ],
  templateUrl: './settings.component.html',
  providers: [
    {
      provide: TUI_VALIDATION_ERRORS,
      useValue: {
        required: 'Value is required',
        email: 'Invalid email address',
        minlength: ({requiredLength, actualLength}: { requiredLength: number; actualLength: number }) =>
          `Password is too short: ${actualLength}/${requiredLength} characters`,
      },
    },
  ],
  styleUrls: ['./settings.component.less']
})
export class SettingsComponent implements OnInit {
  // populated in ngOnInit
  protected userInfo: UserInfo | null = null;
  protected authProviders: string[] = [];

  // email and password settings
  protected emailVerifiedTextExpanded = true;
  protected emailEditable: boolean = false;
  protected passwordEditable: boolean = false;
  protected emailWaitIcon: boolean = false; // not used
  protected emailVerified: boolean = true;
  protected emailForm = new FormGroup({
    emailValue: new FormControl('', [Validators.required, Validators.email]),
  });
  private readonly passwordPlaceholder = '********';

  protected passwordForm = new FormGroup({
    passwordValue: new FormControl(this.passwordPlaceholder, [Validators.required, Validators.minLength(AppConstants.MIN_PASSWORD_LENGTH)]),
  });
  @ViewChild(TuiInputComponent) emailInputComponent!: TuiInputComponent;
  @ViewChild(TuiInputPasswordComponent) passwordInputComponent!: TuiInputPasswordComponent;

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


  constructor(
    private settingService: SettingService,
    private alertService: TuiAlertService,
    private userInfoService: UserInfoService,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private urlService: UrlService
  ) {
  }


  ngOnInit(): void {
    this.displayAppropriateAlerts();
    this.populateAuthMethods();
    this.populateEmail();
    this.checkEmailVerification();
  }

  private displayAppropriateAlerts() {
    this.route.queryParams.subscribe(params => {
      if (params['error']) {
        this.alertService.open(params['error'], {status: 'error'}).subscribe();
        this.urlService.clearUrl();
      } else {
        if (params['intent'] === 'link') {
          this.alertService.open('Account successfully linked!', {status: 'success'}).subscribe();
          this.urlService.clearUrl();
        }
        if (params['intent'] === 'reauth') {
          this.alertService.open('You successfully verified your identity!', {status: 'success'}).subscribe();
          this.urlService.clearUrl();
        }
      }
    });
  }

  private populateAuthMethods() {
    this.settingService.getAuthProviders().subscribe({
      next: (authProviders) => {
        this.authProviders = authProviders.map(provider => provider.toLowerCase());
      },
      error: (error) => {
        console.error(error);
      },
    });
  }

  private populateEmail() {
    this.userInfoService.userInfo$.subscribe((info) => {
      this.userInfo = info;
      if (info) {
        this.emailForm.get('emailValue')?.setValue(info.email);
      }
    });
  }

  private checkEmailVerification() {
    this.settingService.isEmailVerified().subscribe({
      next: (isVerified) => {
        this.emailVerified = isVerified;
      },
      error: (error) => {
        console.error('Error checking email verification:', error);
      },
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
    this.useCountdown = false;
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
    this.closeConfirmModal();

    this.settingService.deleteAccount().subscribe({
      next: () => {  // No response body expected for 204
        this.alertService.open('Account successfully deleted!', {status: 'success'}).subscribe();
        this.userInfoService.clearUserInfo();
        this.router.navigate(['/']).then(r => r);
        this.closeConfirmModal();
      },
      error: (error) => {
        this.alertService
          .open(error.error.message || 'Failed to delete account', {status: 'error'})
          .subscribe();
        this.closeConfirmModal();
      },
    });
  }

  // AUTH PROVIDERS BLOCKS
  // Linking and unlinking social accounts

  // boolean checkers

  protected clickProviderIcon() {
    return;
  }

  protected isProviderLinked(provider: string): boolean {
    return this.authProviders.some(authProvider => authProvider.toLowerCase() === provider.toLowerCase());
  }

  protected isLastLinkedProvider(provider: string): boolean {
    return this.authProviders.length === 1 && this.isProviderLinked(provider);
  }

  protected handleProviderWrapped(provider: string) {
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
    if (provider === 'local') {
      this.authMode = 'linkLocal';
      this.openAuthModal();
      return;
    }
    const providerUrls: { [key: string]: string } = {
      google: AppConstants.GOOGLE_AUTH_URL_WITH_REDIRECT_TO,
      apple: AppConstants.APPLE_AUTH_URL_WITH_REDIRECT_TO,
    };
    window.location.href = providerUrls[provider] + '/settings&intent=link';
  }

  private prepareUnlinkConfirmationModal(provider: string) {
    this.modalTitle = 'Unlink account';
    this.modalMessage = `Are you sure you want to unlink your ${this.getFormattedProvider(provider)} account?`;
    this.modalConfirmText = 'Unlink';
    this.modalAction = () => this.unlinkAccount(provider);
    this.isConfirmModalVisible = true;
  }

  private unlinkAccount(provider: string) {
    this.settingService.unlinkAuthProvider(provider).subscribe({
      next: (reauthRequired: boolean) => {
        this.alertService.open(`${this.getFormattedProvider(provider)} account successfully unlinked!`, {status: 'success'}).subscribe();
        this.authProviders = this.authProviders.filter(authProvider => authProvider !== provider);
        if (reauthRequired) {
          this.alertService.open('Since you used this account to sign in, you will be logged out in 2 seconds.', {status: 'info'}).subscribe();
          setTimeout(() => {
            this.userInfoService.clearUserInfo();
            this.authService.logoutPublic().subscribe();
            this.router.navigate(['/auth'], {fragment: 'sign-in'}).then(r => r);
          }, 2000);
        } else {
        }
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Failed to unlink account', {status: 'error'}).subscribe();
      },
    });
  }

  // AUTH MODAL
  protected closeAuthModal() {
    this.isAuthModalVisible = false;
    this.populateAuthMethods();
  }

  private openAuthModal() {
    this.isAuthModalVisible = true;
  }

  // universal live token auth guard
  private checkAuth(onValidToken: () => void) {
    this.settingService.checkCurrentAccessToken().subscribe({
      next: (data: boolean) => {
        if (data) {
          onValidToken();
        } else {
          this.showIdentityVerificationPopup();
        }
      },
      error: (error) => {
        console.error('Error checking access token:', error);
      }
    });
  }

  private showIdentityVerificationPopup() {
    this.alertService.open('To continue with this action, we need to verify your identity.', {status: 'info'}).subscribe();
    this.authMode = 'embedded'; // do I need this?
    this.openAuthModal();
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
      this.alertService.open('Please enter a valid password', {status: 'error'}).subscribe();
      return;
    }

    this.checkAuth(() => this.changePassword());
  }

  protected requestEmailVerification() {
    if (!this.isProviderLinked('local')) {
      this.alertService.open('To verify your email, you need to link a local account first', {status: 'info'}).subscribe();
      this.authMode = 'linkLocal';
      this.openAuthModal();
      return;
    }

    this.settingService.requestEmailVerification().subscribe({
      next: () => {
        this.alertService.open('Verification email sent!', {status: 'success'}).subscribe();
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Failed to send verification email', {status: 'error'}).subscribe();
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
    this.focusEmailInput();
    this.restorePasswordField();

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
      this.alertService.open('Please enter a valid email address', {status: 'error'}).subscribe();
      return;
    }

    if (this.emailChanged()) {
      this.alertService.open('No changes detected in the email address', {status: 'info'}).subscribe();
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
    this.settingService.changePassword(this.getPasswordFieldValue()).subscribe({
      next: () => {
        this.alertService.open('Password successfully changed!', {status: 'success'}).subscribe();
        this.passwordEditable = false;
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Failed to change password', {status: 'error'}).subscribe();
      },
    });
  }

  private checkAndChangeEmail() {
    this.settingService.isEmailAvailable(this.getEmailFieldValue()).subscribe({
      next: (isAvailable) => {
        if (!isAvailable) {
          this.alertService.open('Email is already in use', {status: 'error'}).subscribe();
          return;
        }

        let hasLocal = this.authProviders.filter(provider => provider === 'local').length > 0
        if (hasLocal) {
          this.sendEmailChangeRequest();
        }
        this.emailEditable = false;
      },
      error: (error) => {
        console.error('Error checking email availability:', error);
      },
    });
  }

  private sendEmailChangeRequest() {
    this.settingService.requestEmailChange(this.getEmailFieldValue()).subscribe({
      next: () => {
        this.alertService.open('Email change request sent!', {status: 'success'}).subscribe();
        this.emailWaitIcon = true;
      },
      error: (error) => {
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
    if (this.passwordInputComponent) {
      this.passwordInputComponent.nativeFocusableElement?.focus();
    }
  }

  private focusEmailInput() {
    if (this.emailInputComponent) {
      this.emailInputComponent.nativeFocusableElement?.focus();
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
