import {TuiInputModule, TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {HttpClient} from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output
} from '@angular/core';
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
import {AsyncPipe, NgClass, NgIf, NgOptimizedImage} from '@angular/common';
import {AuthService} from './auth.service';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {AppConstants} from '../../app.constants';
import {environment} from '../../../environments/environment';
import {NgxParticlesModule} from '@tsparticles/angular'; // Keep this for the component
import {Subject} from "rxjs";
import {DismissButtonComponent} from "../../shared/modals/elements/dismiss-button/dismiss-button.component";
import {ProviderIconComponent} from "../../shared/modals/elements/provider-icon/provider-icon.component";
import {UserInfoService} from "../../services/user-info.service";
import {UrlService} from "../../services/url.service";
import {ParticlesComponent} from "../../shared/particles/particles.component"; // Import your service

declare const google: any;

@Component({
  selector: 'app-auth',
  imports: [
    TuiInputModule,
    TuiError,
    ReactiveFormsModule,
    TuiFieldErrorPipe,
    AsyncPipe,
    NgIf,
    TuiLink,
    TuiTextfieldControllerModule,
    NgOptimizedImage,
    NgxParticlesModule,
    NgClass,
    RouterLink,
    DismissButtonComponent,
    ProviderIconComponent,
    TuiIcon,
    TuiPassword,
    TuiTextfieldComponent,
    TuiTextfieldOptionsDirective,
    TuiTextfield,
    ParticlesComponent,
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

  // EMBEDDED MODE (REAUTHENTICATION)
  @Input() mode: 'embedded' | 'linkLocal' | 'changeEmail' | 'default' = 'default';
  embeddedMode: boolean = false;
  @Output() close = new EventEmitter<void>(); // Emits close event for modal
  private intent: string = '';
  showSeparatorAndForm: boolean = true;
  @Input() providers: string[] = ['apple', 'google', 'local']; // Default are all, to make it work in default mode

  onClose() {
    this.close.emit();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKeyDown(_: KeyboardEvent) {
    this.onClose();
  }

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
  isRotating: boolean = false;

  constructor(
    private authService: AuthService,
    private alertService: TuiAlertService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private userInfoService: UserInfoService,
    private http: HttpClient,
    private urlService: UrlService,
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
    this.isRotating = true;
    const credential = response.credential;

    this.http.post(AppConstants.GOOGLE_ONE_TAP_VERIFY_URL, {token: credential}, {withCredentials: true})
      .subscribe({
        next: () => {
          this.router.navigate(['/home']).then(r => r); // Redirect after successful auth
        },
        error: () => {
          console.error('Error during login', response);
          this.isRotating = false;
        },
      });
  }

  ngOnInit(): void {
    this.userInfoService.userInfo$.subscribe((info) => {
        if (info && this.mode !== 'changeEmail') {
          this.authForm.get('emailValue')?.setValue(info.email);
          this.authForm.get('emailValue')?.disable();
        }
      }
    );

    this.setModes();
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
        this.showSeparatorAndForm = true;
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

  onSubmit() {
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
      this.isRotating = true;
      if (this.isSignUp) {
        this.register(emailValue, passwordValue);
      } else {
        this.login(emailValue, passwordValue);
      }
    }
  }

  private linkLocal(passwordValue: string) {
    this.authService.linkLocalAccount(passwordValue).subscribe({
      next: () => {
        this.alertService.open('Local account linked successfully', {appearance: 'success'}).subscribe();
        this.onClose();
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Failed to link local account', {appearance: 'error'}).subscribe();
        this.onClose();
      },
    });
  }

  private changeEmail(emailValue: string, passwordValue: string) {
    this.authService.linkLocalWithNewEmail(emailValue, passwordValue).subscribe({
      next: () => {
        this.alertService.open('Local account with new email created successfully, please verify it', {appearance: 'success'}).subscribe();
        this.onClose();
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Failed to link local account', {appearance: 'error'}).subscribe();
        this.onClose();
      },
    });
  }

  private register(emailValue: string, passwordValue: string) {
    this.authService.register(emailValue, passwordValue).subscribe({
      next: (response) => {
        this.isRotating = false;
        this.alertService
          .open(response.message || 'Next step, verify your email!', {appearance: 'success'})
          .subscribe();
        this.isSignUp = false;
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Registration failed', {appearance: 'error'}).subscribe();
        this.isRotating = false;
      },
    });
  }

  private login(emailValue: string, passwordValue: string) {
    this.authService.login(emailValue, passwordValue).subscribe({
      next: () => {
        if (this.embeddedMode) {
          this.router.navigate([this.router.url], {queryParams: {intent: 'reauth'}}).then((r) => r);
        } else {
          this.router.navigate(['/home']).then((r) => r);
        }
        this.close.emit();
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Login failed', {appearance: 'error'}).subscribe();
        this.isRotating = false;
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

  toggleSignUp() {
    this.isSignUp = !this.isSignUp;
  }

  onForgotPassword() {
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
  onSocialLogin = (provider: string) => {
    if (provider === 'local') {
      this.showSeparatorAndForm = !this.showSeparatorAndForm;
      this.cdr.markForCheck();
      return;
    }

    this.isRotating = true;
    const providerUrls: { [key: string]: string } = {
      google: AppConstants.GOOGLE_AUTH_URL_WITH_REDIRECT_TO,
      apple: AppConstants.APPLE_AUTH_URL_WITH_REDIRECT_TO,
    };

    window.location.href = providerUrls[provider] + (this.embeddedMode ? this.router.url + '?intent=' + this.intent : '/home');
  };

  // Hovering over the greeting
  onMouseEnter() {
    this.isHovering = true;
  }

  onMouseLeave() {
    this.isHovering = false;
  }
}
