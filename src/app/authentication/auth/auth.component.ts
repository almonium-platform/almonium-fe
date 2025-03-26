import {TuiInputModule, TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {HttpClient} from '@angular/common/http';
import {ChangeDetectorRef, Component, Input, OnDestroy, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {TUI_VALIDATION_ERRORS, TuiFieldErrorPipe, TuiPassword} from '@taiga-ui/kit';
import {
  TuiAlertService,
  TuiError,
  TuiIcon,
  TuiLink,
  TuiTextfield,
  TuiTextfieldComponent,
  TuiTextfieldOptionsDirective
} from '@taiga-ui/core';
import {AsyncPipe, NgClass} from '@angular/common';
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
import {GifPlayerComponent} from "../../shared/gif-player/gif-player.component";
import {ButtonComponent} from "../../shared/button/button.component";
import {UserInfo} from "../../models/userinfo.model";

declare const google: any;

@Component({
  selector: 'app-auth',
  imports: [
    TuiInputModule,
    TuiError,
    ReactiveFormsModule,
    TuiFieldErrorPipe,
    AsyncPipe,
    TuiLink,
    TuiTextfieldControllerModule,
    NgxParticlesModule,
    NgClass,
    RouterLink,
    ProviderIconComponent,
    TuiIcon,
    TuiPassword,
    TuiTextfieldComponent,
    TuiTextfieldOptionsDirective,
    TuiTextfield,
    GifPlayerComponent,
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
  private readonly destroy$ = new Subject<void>();
  @ViewChild('auth', {static: true}) content!: TemplateRef<any>;

  private userInfo: UserInfo | null = null;
  @Input() mode: 'embedded' | 'linkLocal' | 'changeEmail' | 'default' = 'default';
  protected providers: string[] = ['google', 'apple', 'local'];

  protected embeddedMode: boolean = false;
  private intent: string = '';
  protected showSeparatorAndForm: boolean = true;
  protected connectedProviders: string[] = [];

  // MAIN COMPONENT
  // legal links
  private readonly TERMS_OF_USE_PATH = '/terms-of-use';
  private readonly PRIVACY_POLICY_PATH = '/privacy-policy';
  protected termsOfUseUrl: string = `${environment.feUrl}${this.TERMS_OF_USE_PATH}`;
  protected privacyPolicyUrl: string = `${environment.feUrl}${this.PRIVACY_POLICY_PATH}`;

  // greetings
  greetings: { [key: string]: string } = {};
  currentGreeting: string = Object.keys(this.greetings)[0];
  currentLanguage: string = this.greetings[this.currentGreeting];
  isHovering: boolean = false;

  // form
  authForm = new FormGroup({
    emailValue: new FormControl('', [Validators.required, Validators.email]),
    passwordValue: new FormControl('', [Validators.required, Validators.minLength(AppConstants.MIN_PASSWORD_LENGTH)]),
  });
  isSignUp: boolean = false;

  // logo
  protected replayGifTrigger = new Subject<void>();

  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();

  constructor(
    private authService: AuthService,
    private authSettingsService: AuthSettingsService,
    private alertService: TuiAlertService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private userInfoService: UserInfoService,
    private http: HttpClient,
    private urlService: UrlService,
    private popupTemplateStateService: PopupTemplateStateService,
  ) {
  }

  initializeGoogleSignIn() {
    const handleResponse = this.handleCredentialResponse.bind(this);

    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: handleResponse,
    });

    // Automatically prompt the popup on page load
    google.accounts.id.prompt();
  }

  handleCredentialResponse(response: any) {
    this.replayGifTrigger.next();
    const credential = response.credential;

    this.http.post(AppConstants.GOOGLE_ONE_TAP_VERIFY_URL, {token: credential}, {withCredentials: true})
      .subscribe({
        next: () => {
          this.router.navigate(['/home']).then(); // Redirect after successful auth
        },
        error: () => {
          console.error('Error during login', response);
        },
      });
  }

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
      this.authSettingsService.populateAuthMethods().subscribe(
        (providers) => {
          this.connectedProviders = providers.map((provider) => provider.provider.toLowerCase());
        }
      );
    }

    this.route.queryParams.subscribe(params => {
      if (params['error']) {
        this.alertService.open(params['error'], {appearance: 'error'}).subscribe();
        this.urlService.clearUrl();
      }
    });

    this.userInfoService.userInfo$.subscribe((info) => {
      if (info) {
        this.authForm.get('emailValue')?.setValue(info.email);
      }
    });

    if (this.mode === 'default') {
      this.loadGoogleSignInScript().then(() => {
        this.initializeGoogleSignIn();
      });
    }

    this.route.fragment.subscribe((fragment) => {
      if (fragment === 'sign-up') {
        this.isSignUp = true;
      } else if (fragment === 'sign-in') {
        this.isSignUp = false;
      }
    });

    this.loadGreetings();

    setInterval(() => {
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
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadGreetings(): void {
    this.http.get<{ [key: string]: string }>('/assets/greetings.json').subscribe({
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
        console.error('Error loading greetings:', error);
      }
    });
  }

  protected onSubmit() {
    if (!this.authForm.valid) {
      console.error('Button should be disabled');
      return;
    }

    const emailValue = this.authForm.get('emailValue')?.value!;
    const passwordValue = this.authForm.get('passwordValue')?.value!;

    if (this.mode === 'linkLocal') {
      this.linkLocal(passwordValue);
    } else if (this.mode === 'changeEmail') {
      this.changeEmail(emailValue, passwordValue);
    } else if (this.mode === 'embedded') {
      this.login(emailValue, passwordValue);
    } else {
      this.replayGifTrigger.next();
      if (this.isSignUp) {
        this.register(emailValue, passwordValue);
      } else {
        this.login(emailValue, passwordValue);
      }
    }
  }

  private linkLocal(passwordValue: string) {
    this.loadingSubject$.next(true);

    this.authService.linkLocalAccount(passwordValue)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: () => {
          this.alertService.open('Local account linked successfully', {appearance: 'success'}).subscribe();
          this.popupTemplateStateService.close();
        },
        error: (error) => {
          this.alertService.open(error.error.message || 'Failed to link local account', {appearance: 'error'}).subscribe();
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
          this.alertService.open('Local account with new email created successfully, please verify it', {appearance: 'success'}).subscribe();
          this.popupTemplateStateService.close();
        },
        error: (error) => {
          this.alertService.open(error.error.message || 'Failed to link local account', {appearance: 'error'}).subscribe();
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
            .open(response.message || 'Next step, verify your email!', {appearance: 'success'})
            .subscribe();
          this.isSignUp = false;
        },
        error: (error) => {
          this.alertService.open(error.error.message || 'Registration failed', {appearance: 'error'}).subscribe();
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
            this.router.navigate([this.router.url], {queryParams: {intent: 'reauth'}}).then();
            this.popupTemplateStateService.close();
          },
          error: (error) => {
            this.alertService.open(error.error.message || 'Identity verification failed', {appearance: 'error'}).subscribe();
          },
        });
      return;
    }

    this.authService.login(emailValue, passwordValue)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: () => {
          this.router.navigate(['/home']).then();
          this.popupTemplateStateService.close();
        },
        error: (error) => {
          this.alertService.open(error.error.message || 'Login failed', {appearance: 'error'}).subscribe();
        },
      });
  }

  private loadGoogleSignInScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof google !== 'undefined') {
        resolve();  // Script is already loaded
      } else {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.onload = () => {
          resolve();
        };
        script.onerror = () => reject('Google Sign-In script could not be loaded.');
        document.head.appendChild(script);
      }
    });
  }

  protected toggleSignUp() {
    this.isSignUp = !this.isSignUp;
  }

  protected onForgotPassword() {
    const emailValue = this.authForm.get('emailValue')?.value!;
    if (!emailValue) {
      this.alertService.open('Please enter your email address', {appearance: 'error'}).subscribe();
      return;
    }
    this.authService.forgotPassword(emailValue).subscribe({
      next: (response) => {
        this.alertService.open(response.message || 'Password reset link sent!', {appearance: 'success'}).subscribe();
      },
      error: (error) => {
        this.alertService
          .open(error.error.message || 'Failed to send password reset link', {appearance: 'error'})
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

    this.replayGifTrigger.next();
    const providerUrls: { [key: string]: string } = {
      google: AppConstants.GOOGLE_AUTH_URL_WITH_REDIRECT_TO,
      apple: AppConstants.APPLE_AUTH_URL_WITH_REDIRECT_TO,
    };

    const redirectUrl = this.embeddedMode
      ? this.router.url + '&intent=' + this.intent
      + (this.intent === 'reauth' ? '&userId=' + this.userInfo?.id : '')
      : '/home';

    window.location.href = providerUrls[provider] + redirectUrl;
  };

  get actionBtnText(): string {
    if (this.mode === 'linkLocal' || this.mode === 'changeEmail') {
      return 'Link Account';
    } else if (this.isSignUp) {
      return 'Sign Up';
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
