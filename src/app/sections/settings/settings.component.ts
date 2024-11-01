import {AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
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
    TuiTextfieldControllerModule
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
export class SettingsComponent implements OnInit, AfterViewInit {
  protected emailForm = new FormGroup({
    emailValue: new FormControl('', [Validators.required, Validators.email]),
  });
  private minimumPasswordLength: number = 8;
  protected passwordForm = new FormGroup({
    passwordValue: new FormControl('', [Validators.required, Validators.minLength(this.minimumPasswordLength)]),
  });

  protected authProviders: string[] = [];
  protected emailVerified: boolean = true;
  protected emailEditable: boolean = false;
  protected passwordEditable: boolean = false;
  protected authMode: 'embedded' | 'linkLocal' | 'changeEmail' = 'embedded';
  protected isAuthModalVisible: boolean = false;
  protected isModalVisible: boolean = false;
  protected modalTitle = '';
  protected modalMessage = '';
  protected modalConfirmText = '';
  protected modalAction: (() => void) | null = null; // Store the action to perform on confirm
  protected useCountdown: boolean = false;
  protected emailWaitIcon: boolean = false;
  protected userInfo: UserInfo | null = null;
  @ViewChild('emailInput') emailInput!: ElementRef;
  @ViewChild('passwordInput') passwordInput!: ElementRef;


  @ViewChild(TuiInputComponent) emailInputComponent!: TuiInputComponent;
  @ViewChild(TuiInputPasswordComponent) passwordInputComponent!: TuiInputPasswordComponent;

  constructor(
    private settingService: SettingService,
    private alertService: TuiAlertService,
    private userInfoService: UserInfoService,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
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

  ngOnInit(): void {
    this.getAuthMethods();
    this.route.queryParams.subscribe(params => {
      if (params['error']) {
        this.alertService.open(params['error'], {status: 'error'}).subscribe();
        this.clearUrl();
      } else {
        if (params['intent'] === 'link') {
          this.alertService.open('Account successfully linked!', {status: 'success'}).subscribe();
          this.clearUrl();
        }
        if (params['intent'] === 'reauth') {
          this.alertService.open('You successfully verified your identity!', {status: 'success'}).subscribe();
          this.clearUrl();
        }
      }
    });
    this.passwordForm.get('passwordValue')?.setValue(this.passwordPlaceholder);

    this.userInfoService.userInfo$.subscribe((info) => {
      this.userInfo = info;
      if (info) {
        this.emailForm.get('emailValue')?.setValue(info.email);
      }
    });
    this.checkEmailVerification();
  }

  private clearUrl() {
    const url = this.router.createUrlTree([], {relativeTo: this.route, queryParams: {}}).toString();
    this.router.navigateByUrl(url, {replaceUrl: true}).then(r => r);
  }

  private getAuthMethods() {
    this.settingService.getAuthProviders().subscribe({
      next: (authProviders) => {
        this.authProviders = authProviders.map(provider => provider.toLowerCase());
        console.log('Auth providers: ', this.authProviders);
      },
      error: (error) => {
        console.error(error);
      },
    });
  }

  checkAuth(onValidToken: () => void) {
    this.settingService.checkCurrentAccessToken().subscribe({
      next: (data: boolean) => {
        console.log('Access token valid:', data);
        if (data) {
          onValidToken();
        } else {
          this.showAuthPopup();
        }
      },
      error: (error) => {
        console.error('Error checking access token:', error);
      }
    });
  }

  private showAuthPopup() {
    this.alertService.open('To continue with this action, we need to verify your identity.', {status: 'info'}).subscribe();
    this.authMode = 'embedded'; // do i need this?
    this.openAuthModal();
  }

  private restoreEmailAndPasswordFields() {
    this.restoreEmailField();
    this.restorePasswordField();
  }

  onDeleteAccount() {
    this.restoreEmailAndPasswordFields();
    this.checkAuth(this.showDeleteAccountPopup.bind(this));
  }

  // Delete account popup
  showDeleteAccountPopup() {
    this.modalTitle = 'Delete Account';
    this.modalMessage = 'Are you sure? This action cannot be undone';
    this.modalConfirmText = 'Delete Account';
    this.modalAction = this.confirmDeletion.bind(this); // Assign the delete function
    this.useCountdown = true;
    this.isModalVisible = true;
  }

  closeModal() {
    this.isModalVisible = false;
    this.useCountdown = false;
  }

  confirmDeletion() {
    this.closeModal();

    this.settingService.deleteAccount().subscribe({
      next: () => {  // No response body expected for 204
        this.alertService.open('Account successfully deleted!', {status: 'success'}).subscribe();
        this.userInfoService.clearUserInfo();
        this.router.navigate(['/']).then(r => r);
        this.closeModal();
      },
      error: (error) => {
        this.alertService
          .open(error.error.message || 'Failed to delete account', {status: 'error'})
          .subscribe();
        this.closeModal();
      },
    });
  }

  checkEmailVerification() {
    this.settingService.isEmailVerified().subscribe({
      next: (isVerified) => {
        console.log('Email verified:', isVerified);
        this.emailVerified = isVerified;
      },
      error: (error) => {
        console.error('Error checking email verification:', error);
      },
    });
  }

  // Linking and unlinking social accounts
  isProviderLinked(provider: string): boolean {
    return this.authProviders.some(authProvider => authProvider.toLowerCase() === provider.toLowerCase());
  }

  // Check if only one provider is linked and it matches the specified provider
  isLastLinkedProvider(provider: string): boolean {
    return this.authProviders.length === 1 && this.isProviderLinked(provider);
    // return true;
  }

  linkAuthMethod(provider: string) {
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


  handleProviderWrapped(provider: string) {
    this.restoreEmailAndPasswordFields();
    this.checkAuth(() => this.handleProvider(provider));
  }

  handleProvider(provider: string) {
    if (this.isProviderLinked(provider)) {
      console.log('Unlinking account with provider:', provider);
      // Set properties for unlink confirmation
      this.modalTitle = 'Unlink account';
      this.modalMessage = `Are you sure you want to unlink your ${this.getFormattedProvider(provider)} account?`;
      this.modalConfirmText = 'Unlink';
      this.modalAction = () => this.unlinkAccount(provider); // Assign the unlink function
      this.isModalVisible = true;
    } else {
      this.linkAuthMethod(provider);
    }
  }

  confirmModalAction() {
    if (this.modalAction) {
      this.modalAction(); // Execute the assigned action
    }
    this.closeModal();
  }

  unlinkAccount(provider: string) {
    this.settingService.unlinkAuthProvider(provider).subscribe({
      next: (reauthRequired: boolean) => {
        this.alertService.open(`${this.getFormattedProvider(provider)} account successfully unlinked!`, {status: 'success'}).subscribe();
        this.authProviders = this.authProviders.filter(authProvider => authProvider !== provider);
        console.log('Remaining auth providers:', this.authProviders);
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

  private getFormattedProvider(provider: string) {
    return provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase();
  }

  private readonly passwordPlaceholder = '********';

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
    }
  }

  onEmailChangeWrapped() {
    this.focusEmailInput();
    this.restorePasswordField();

    this.checkAuth(() => this.onEmailChange());
  }

  // auth modal toggle
  onEmailChange() {
    this.focusEmailInput();

    console.log("PROVIDERS", this.authProviders);
    if (!this.isProviderLinked('local')) {
      this.authMode = 'changeEmail';
      this.openAuthModal();
      return;
    }

    if (!this.emailEditable) {
      this.emailEditable = true;
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
    const currentEmail = this.emailForm.get('emailValue')?.value?.toString().trim();
    const initialEmail = this.userInfo?.email;
    return currentEmail === initialEmail;
  }

  changePassword() {
    this.settingService.changePassword(this.passwordForm.get('passwordValue')?.value?.toString()!).subscribe({
      next: () => {
        this.alertService.open('Password successfully changed!', {status: 'success'}).subscribe();
        this.passwordEditable = false;
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Failed to change password', {status: 'error'}).subscribe();
      },
    });
  }

  checkAndChangeEmail() {
    this.settingService.isEmailAvailable(this.emailForm.get('emailValue')?.value?.toString().trim()!).subscribe({
      next: (isAvailable) => {
        if (isAvailable) {
          console.log('Email is available');
          let hasLocal = this.authProviders.filter(provider => provider === 'local').length > 0
          if (hasLocal) {
            this.settingService.requestEmailChange(this.emailForm.get('emailValue')?.value?.toString()!).subscribe({
              next: () => {
                this.alertService.open('Email change request sent!', {status: 'success'}).subscribe();
                this.emailWaitIcon = true;
              },
              error: (error) => {
                console.error('Error sending email change request:', error);
              }
            });
          }
          this.emailEditable = false;
        } else {
          this.alertService.open('Email is already in use', {status: 'error'}).subscribe();
        }
      },
      error: (error) => {
        console.error('Error checking email availability:', error);
      },
    });
  }

  openAuthModal() {
    this.isAuthModalVisible = true;
  }

  closeAuthModal() {
    this.isAuthModalVisible = false;
    this.getAuthMethods();
  }

  emailOnSubmit() {
    console.log('Email form submitted');
  }

  ngAfterViewInit(): void {
  }

  passwordSubmitWrapped() {
    this.restoreEmailField();
    this.checkAuth(this.passwordSubmit.bind(this));
  }

  passwordSubmit() {
    this.focusPasswordInput();
    this.cdr.detectChanges();

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

  requestEmailVerification() {
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

}
