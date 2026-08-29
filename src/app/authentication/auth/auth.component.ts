import {logger} from "../../shared/logger";
import {getErrorMessage} from '../../shared/http-error';
import {HttpClient} from '@angular/common/http';
import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {TuiPassword} from '@taiga-ui/kit/directives';
import {TuiError, TuiIcon, TuiInput, TuiLink, TuiNotificationService, TuiTextfieldComponent, TuiTextfieldOptionsDirective} from '@taiga-ui/core/components';
import {TUI_VALIDATION_ERRORS} from '@taiga-ui/core/tokens';
import {NgClass} from '@angular/common';
import {AuthService} from './auth.service';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {AppConstants} from '../../app.constants';
import {environment} from '../../../environments/environment';
import {NgxParticlesModule} from '@tsparticles/angular'; // Keep this for the component
import {BehaviorSubject, finalize, Subject, takeUntil} from "rxjs";
import {ProviderIconComponent} from "../../shared/modals/elements/provider-icon/provider-icon.component";
import {UserInfoService} from "../../services/user-info.service";
import {UrlService} from "../../services/url.service";
import {AuthSettingsService} from "../../sections/settings/auth/auth-settings.service";
import {PopupTemplateStateService} from "../../shared/modals/popup-template/popup-template-state.service";
import {ButtonComponent} from "../../shared/button/button.component";
import {UserInfo} from "../../models/userinfo.model";

@Component({
  selector: 'app-auth',
  imports: [
    TuiError,
    ReactiveFormsModule,
    TuiLink,
    NgxParticlesModule,
    NgClass,
    RouterLink,
    ProviderIconComponent,
    TuiIcon,
    TuiPassword,
    TuiTextfieldComponent,
    TuiTextfieldOptionsDirective,
    TuiInput,
    ButtonComponent
  ],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.less'],
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
  ]
})
export class AuthComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private authSettingsService = inject(AuthSettingsService);
  private alertService = inject(TuiNotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private userInfoService = inject(UserInfoService);
  private http = inject(HttpClient);
  private urlService = inject(UrlService);
  private popupTemplateStateService = inject(PopupTemplateStateService);

  private readonly destroy$ = new Subject<void>();
  private greetingInterval?: ReturnType<typeof setInterval>;
  @ViewChild('auth', {static: true}) content!: TemplateRef<unknown>;

  private userInfo: UserInfo | null = null;
  @Input() mode: 'embedded' | 'linkLocal' | 'changeEmail' | 'default' = 'default';
  protected providers: string[] = ['google', 'apple', 'local'];

  protected embeddedMode = false;
  private intent = '';
  protected showSeparatorAndForm = true;
  protected connectedProviders: string[] = [];

  // MAIN COMPONENT
  // legal links
  private readonly TERMS_OF_USE_PATH = '/terms-of-use';
  private readonly PRIVACY_POLICY_PATH = '/privacy-policy';
  protected termsOfUseUrl = `${environment.feUrl}${this.TERMS_OF_USE_PATH}`;
  protected privacyPolicyUrl = `${environment.feUrl}${this.PRIVACY_POLICY_PATH}`;
  protected readonly minimumPasswordLength = AppConstants.MIN_PASSWORD_LENGTH;

  // greetings
  greetings: Record<string, string> = {};
  currentGreeting: string = Object.keys(this.greetings)[0];
  currentLanguage: string = this.greetings[this.currentGreeting];
  isHovering = false;

  // form
  authForm = new FormGroup({
    emailValue: new FormControl('', [Validators.required, Validators.email]),
    passwordValue: new FormControl('', [Validators.required, Validators.minLength(AppConstants.MIN_PASSWORD_LENGTH)]),
  });
  isSignUp = false;
  protected emailIdentified = false;
  protected accountExists = false;

  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();

  ngOnInit(): void {
    this.userInfoService.userInfo$
      .pipe(takeUntil(this.destroy$))
      .subscribe((info) => {
          if (info) {
            this.userInfo = info;

            if (this.mode !== 'changeEmail') {
              this.authForm.get('emailValue')?.setValue(info.email);
              this.authForm.get('emailValue')?.disable();
            }
          }
        }
      );

    this.setModes();

    if (this.mode === 'embedded') {
      this.authSettingsService.populateAuthMethods().pipe(takeUntil(this.destroy$)).subscribe(
        (providers) => {
          this.connectedProviders = providers.map((provider) => provider.provider.toLowerCase());
        }
      );
    }

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const error = params.get('error');
      if (error) {
        this.alertService.open(error, {appearance: 'negative'}).subscribe();
        this.urlService.clearUrl();
      }
    });

    this.userInfoService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe((info) => {
      if (info) {
        this.authForm.get('emailValue')?.setValue(info.email);
      }
    });

    this.route.fragment.pipe(takeUntil(this.destroy$)).subscribe((fragment) => {
      if (fragment === 'sign-up') {
        this.isSignUp = true;
      } else if (fragment === 'sign-in') {
        this.isSignUp = false;
      }
    });

    this.loadGreetings();

    this.greetingInterval = setInterval(() => {
      if (!this.isHovering && Object.keys(this.greetings).length > 0) {
        const greetingKeys = Object.keys(this.greetings);
        this.currentGreeting = greetingKeys[Math.floor(Math.random() * greetingKeys.length)];
        this.currentLanguage = this.greetings[this.currentGreeting];
        this.cdr.detectChanges();
      }
    }, 2000);
  }

  private setModes() {
    switch (this.mode) {
      case 'embedded':
        this.embeddedMode = true;
        this.isSignUp = false;
        this.showSeparatorAndForm = this.providers.length === 1 && this.providers[0].toLowerCase() === 'local';
        this.intent = 'reauth';
        break;
      case 'linkLocal':
        this.embeddedMode = true;
        this.showSeparatorAndForm = true;
        this.isSignUp = false;
        this.intent = 'link';
        break;
      case 'changeEmail':
        this.embeddedMode = true;
        this.showSeparatorAndForm = true;
        this.isSignUp = false;
        break;
      default:
        this.embeddedMode = false;
        this.isSignUp = false;
        this.showSeparatorAndForm = false;
        break;
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.greetingInterval);
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadGreetings(): void {
    this.http.get<Record<string, string>>('/assets/greetings.json').subscribe({
      next: (data) => {
        this.greetings = data;

        // Initialize currentGreeting and currentLanguage after data is loaded
        const greetingKeys = Object.keys(this.greetings);
        if (greetingKeys.length > 0) {
          this.currentGreeting = greetingKeys[0];
          this.currentLanguage = this.greetings[this.currentGreeting];
        }
      },
      error: (error) => {
        logger.error('Error loading greetings:', error);
      }
    });
  }

  protected onSubmit() {
    if (this.mode === 'default' && !this.emailIdentified) {
      if (this.authForm.controls.emailValue.invalid) {
        this.authForm.controls.emailValue.markAsTouched();
        return;
      }
      this.identifyEmail();
      return;
    }

    if (!this.authForm.valid) {
      this.authForm.markAllAsTouched();
      logger.error('Button should be disabled');
      return;
    }

    const emailValue = this.authForm.controls.emailValue.value ?? '';
    const passwordValue = this.authForm.controls.passwordValue.value ?? '';

    if (this.mode === 'linkLocal') {
      this.linkLocal(passwordValue);
    } else if (this.mode === 'changeEmail') {
      this.changeEmail(emailValue, passwordValue);
    } else if (this.mode === 'embedded') {
      this.login(emailValue, passwordValue);
    } else {
      if (!this.accountExists) {
        this.register(emailValue, passwordValue);
      } else {
        this.login(emailValue, passwordValue);
      }
    }
  }

  private identifyEmail() {
    const email = this.authForm.controls.emailValue.value ?? '';
    this.loadingSubject$.next(true);
    this.authService.lookupEmailAccount(email)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: ({registered}) => {
          this.accountExists = registered;
          this.isSignUp = !registered;
          this.emailIdentified = true;
          this.authForm.controls.emailValue.disable();
          this.cdr.markForCheck();
        },
        error: (error) => this.alertService
          .open(getErrorMessage(error, 'Could not check this email address'), {appearance: 'negative'})
          .subscribe(),
      });
  }

  protected changeIdentifiedEmail() {
    this.emailIdentified = false;
    this.accountExists = false;
    this.isSignUp = false;
    this.authForm.controls.emailValue.enable();
    this.authForm.controls.passwordValue.reset('');
    this.cdr.markForCheck();
  }

  private linkLocal(passwordValue: string) {
    this.loadingSubject$.next(true);

    this.authService.linkLocalAccount(passwordValue)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: () => {
          this.alertService.open('Local account linked', {appearance: 'positive'}).subscribe();
          this.popupTemplateStateService.close();
        },
        error: (error) => {
          this.alertService.open(getErrorMessage(error, 'Failed to link local account'), {appearance: 'negative'}).subscribe();
          this.popupTemplateStateService.close();
        },
      });
  }

  private changeEmail(emailValue: string, passwordValue: string) {
    this.loadingSubject$.next(true);

    this.authService.linkLocalWithNewEmail(emailValue, passwordValue)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: () => {
          this.alertService.open('Local account with new email created successfully, please verify it', {appearance: 'positive'}).subscribe();
          this.popupTemplateStateService.close();
        },
        error: (error) => {
          this.alertService.open(getErrorMessage(error, 'Failed to link local account'), {appearance: 'negative'}).subscribe();
          this.popupTemplateStateService.close();
        },
      });
  }

  private register(emailValue: string, passwordValue: string) {
    this.loadingSubject$.next(true);

    this.authService.register(emailValue, passwordValue)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: (response) => {
          this.alertService
            .open(response.message || 'Next step, verify your email!', {appearance: 'positive'})
            .subscribe();
          this.changeIdentifiedEmail();
        },
        error: (error) => {
          this.alertService.open(getErrorMessage(error, 'Registration failed'), {appearance: 'negative'}).subscribe();
        },
      });
  }

  private login(emailValue: string, passwordValue: string) {
    this.loadingSubject$.next(true);

    if (this.embeddedMode) {
      this.authService.reauth(passwordValue)
        .pipe(finalize(() => this.loadingSubject$.next(false)))
        .subscribe({
          next: () => {
            void this.router.navigate([this.router.url], {queryParams: {intent: 'reauth'}}).then();
            this.popupTemplateStateService.close();
          },
          error: (error) => {
            this.alertService.open(getErrorMessage(error, 'Identity verification failed'), {appearance: 'negative'}).subscribe();
          },
        });
      return;
    }

    this.authService.login(emailValue, passwordValue) // This now fetches user info on success
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: (userInfo) => {
          if (userInfo) {
            void this.router.navigate(['/home']).then();
            this.popupTemplateStateService.close();
          } else {
            this.alertService.open('Login successful, but failed to retrieve user data.', {appearance: 'negative'}).subscribe();
          }
        },
        error: (error) => {
          this.alertService.open(getErrorMessage(error, 'Login failed'), {appearance: 'negative'}).subscribe();
        },
      });
  }

  protected toggleSignUp() {
    this.isSignUp = !this.isSignUp;
  }

  protected onForgotPassword() {
    const emailValue = this.authForm.controls.emailValue.value ?? '';
    if (!emailValue) {
      this.alertService.open('Please enter your email address', {appearance: 'negative'}).subscribe();
      return;
    }
    this.authService.forgotPassword(emailValue).subscribe({
      next: (response) => {
        this.alertService.open(response.message || 'Password reset link sent!', {appearance: 'positive'}).subscribe();
      },
      error: (error) => {
        this.alertService
          .open(getErrorMessage(error, 'Failed to send password reset link'), {appearance: 'negative'})
          .subscribe();
      },
    });
  }

  // should be defined as an arrow function to access 'this'
  protected onSocialLogin = (provider: string) => {
    if (provider === 'local') {
      this.showSeparatorAndForm = !this.showSeparatorAndForm;
      this.cdr.markForCheck();
      return;
    }

    if (provider !== 'google' && provider !== 'apple') return;

    this.loadingSubject$.next(true);
    const mode = this.intent === 'link' ? 'link' : this.embeddedMode ? 'reauth' : 'sign-in';
    const signIn = provider === 'apple'
      ? this.authService.appleSignIn(mode)
      : this.authService.googleSignIn(mode);
    signIn
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: () => {
          if (this.embeddedMode) {
            void this.router.navigate([this.router.url], {queryParams: {intent: this.intent}}).then();
            this.popupTemplateStateService.close();
          } else {
            void this.router.navigate(['/home']).then();
          }
        },
        error: error => this.alertService
          .open(getErrorMessage(error, `${provider === 'apple' ? 'Apple' : 'Google'} authentication failed`), {appearance: 'negative'})
          .subscribe(),
      });
  };

  get actionBtnText(): string {
    if (this.mode === 'linkLocal' || this.mode === 'changeEmail') {
      return 'Link Account';
    } else if (this.mode === 'default' && !this.emailIdentified) {
      return 'Continue';
    } else if (this.isSignUp) {
      return 'Create account';
    } else {
      return 'Sign In';
    }
  }

  // Hovering over the greeting
  protected onMouseEnter() {
    this.isHovering = true;
  }

  protected onMouseLeave() {
    this.isHovering = false;
  }
}
