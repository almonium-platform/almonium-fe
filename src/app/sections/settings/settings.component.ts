import {Component, OnInit} from '@angular/core';
import {NavbarComponent} from "../../shared/navbars/navbar/navbar.component";
import {NgForOf, NgIf, NgOptimizedImage, NgStyle, NgTemplateOutlet} from "@angular/common";
import {NotReadyComponent} from "../../shared/not-ready/not-ready.component";
import {ConfirmModalComponent} from "../../shared/modals/confirm-modal/confirm-modal.component";
import {SettingService} from "./settings.service";
import {TuiAlertService} from "@taiga-ui/core";
import {Router} from "@angular/router";
import {UserInfoService} from "../../services/user-info.service";
import {AppConstants} from "../../app.constants";
import {AuthComponent} from "../../authentication/auth/auth.component";

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
    AuthComponent
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.less']
})
export class SettingsComponent implements OnInit {
  protected authProviders: string[] = [];
  protected emailVerified: boolean = true;

  protected isAuthModalVisible: boolean = false;
  protected isModalVisible: boolean = false;
  protected modalTitle = '';
  protected modalMessage = '';
  protected modalConfirmText = '';
  protected modalAction: (() => void) | null = null; // Store the action to perform on confirm
  protected useCountdown: boolean = false;

  constructor(
    private settingService: SettingService,
    private alertService: TuiAlertService,
    private userInfoService: UserInfoService,
    private router: Router,
  ) {
  }

  ngOnInit(): void {
    this.settingService.getAuthProviders().subscribe({
      next: (authProviders) => {
        this.authProviders = authProviders;
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

  showAuthPopup() {
    this.alertService.open('To continue with this action, we need to verify your identity.', {status: 'info'}).subscribe();
    this.openAuthModal();
  }

  onDeleteAccount() {
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
        this.emailVerified = isVerified;
      },
      error: (error) => {
        console.error('Error checking email verification:', error);
      },
    });
  }

  // Linking and unlinking social accounts
  isProviderLinked(provider: string): boolean {
    return this.authProviders.some(authProvider => authProvider === provider);
  }

  // Check if only one provider is linked and it matches the specified provider
  isLastLinkedProvider(provider: string): boolean {
    return this.authProviders.length === 1 && this.isProviderLinked(provider);
    // return true;
  }

  onSocialLogin(provider: string) {
    const providerUrls: { [key: string]: string } = {
      GOOGLE: AppConstants.GOOGLE_AUTH_URL_WITH_REDIRECT_TO,
      APPLE: AppConstants.APPLE_AUTH_URL_WITH_REDIRECT_TO,
    };

    window.location.href = providerUrls[provider] + '/settings';
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
      this.onSocialLogin(provider);
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
      next: () => {
        this.authProviders = this.authProviders.filter(authProvider => authProvider !== provider);
        this.alertService.open(`${this.getFormattedProvider(provider)} account successfully unlinked!`, {status: 'success'}).subscribe();
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Failed to unlink account', {status: 'error'}).subscribe();
      },
    });
  }

  private getFormattedProvider(provider: string) {
    return provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase();
  }

  // auth modal toggle
  openAuthModal() {
    this.isAuthModalVisible = true;
  }

  closeAuthModal() {
    this.isAuthModalVisible = false;
  }
}
