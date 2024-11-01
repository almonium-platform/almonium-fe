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
import {TUI_VALIDATION_ERRORS, TuiFieldErrorPipeModule, TuiInputModule, TuiInputPasswordModule} from '@taiga-ui/kit';
import {
  TuiAlertService,
  TuiButtonModule,
  TuiErrorModule,
  TuiLinkModule,
  TuiTextfieldControllerModule,
} from '@taiga-ui/core';
import {AsyncPipe, NgClass, NgIf, NgOptimizedImage, NgStyle, NgTemplateOutlet} from '@angular/common';
import {AuthService} from './auth.service';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {AppConstants} from '../../app.constants';
import {environment} from '../../../environments/environment';
import {IParticlesProps, NgxParticlesModule} from '@tsparticles/angular'; // Keep this for the component
import {ParticlesService} from '../../services/particles.service';
import {Subscription} from "rxjs";
import {DismissButtonComponent} from "../../shared/modals/elements/dismiss-button/dismiss-button.component";
import {ProviderIconComponent} from "../../shared/modals/elements/provider-icon/provider-icon.component";
import {UserInfoService} from "../../services/user-info.service"; // Import your service

declare const google: any;

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [
    TuiInputModule,
    TuiErrorModule,
    TuiInputPasswordModule,
    ReactiveFormsModule,
    TuiFieldErrorPipeModule,
    AsyncPipe,
    TuiButtonModule,
    NgIf,
    TuiLinkModule,
    TuiTextfieldControllerModule,
    NgOptimizedImage,
    NgxParticlesModule,
    NgClass,
    RouterLink,
    DismissButtonComponent,
    NgTemplateOutlet,
    NgStyle,
    ProviderIconComponent,
  ],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.less'],
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
})
export class AuthComponent implements OnInit, OnDestroy {
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
  minimumPasswordLength: number = 8;
  authForm = new FormGroup({
    emailValue: new FormControl('', [Validators.required, Validators.email]),
    passwordValue: new FormControl('', [Validators.required, Validators.minLength(this.minimumPasswordLength)]),
  });
  isSignUp: boolean = false;

  // particles
  id = 'tsparticles';
  particlesOptions: IParticlesProps | undefined;
  particlesOptionsSubscription: Subscription | undefined;

  // logo
  isRotating: boolean = false;

  constructor(
    private authService: AuthService,
    private alertService: TuiAlertService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    protected particlesService: ParticlesService,
    private userInfoService: UserInfoService,
    private http: HttpClient
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

  private clearUrl() {
    const url = this.router.createUrlTree([], {relativeTo: this.route, queryParams: {}}).toString();
    this.router.navigateByUrl(url, {replaceUrl: true}).then(r => r);
  }

  ngOnInit(): void {
    console.log('AuthComponent mode:', this.mode);
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
        this.alertService.open(params['error'], {status: 'error'}).subscribe();
        this.clearUrl();
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

    this.particlesService.initializeParticles();
    this.particlesOptionsSubscription = this.particlesService.particlesOptions$.subscribe(options => {
      this.particlesOptions = options;
    });

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
        this.isSignUp = true;
        this.showSeparatorAndForm = true;
        break;
    }
  }

  ngOnDestroy(): void {
    if (this.particlesOptionsSubscription) {
      this.particlesOptionsSubscription.unsubscribe();
    }
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
        this.alertService.open('Local account linked successfully', {status: 'success'}).subscribe();
        this.onClose();
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Failed to link local account', {status: 'error'}).subscribe();
        this.onClose();
      },
    });
  }

  private changeEmail(emailValue: string, passwordValue: string) {
    this.authService.linkLocalWithNewEmail(emailValue, passwordValue).subscribe({
      next: () => {
        this.alertService.open('Local account with new email created successfully, please verify it', {status: 'success'}).subscribe();
        this.onClose();
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Failed to link local account', {status: 'error'}).subscribe();
        this.onClose();
      },
    });
  }

  private register(emailValue: string, passwordValue: string) {
    this.authService.register(emailValue, passwordValue).subscribe({
      next: (response) => {
        this.isRotating = false;
        this.alertService
          .open(response.message || 'Next step, verify your email!', {status: 'success'})
          .subscribe();
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Registration failed', {status: 'error'}).subscribe();
        this.isRotating = false;
      },
    });
  }

  private login(emailValue: string, passwordValue: string) {
    this.authService.login(emailValue, passwordValue).subscribe({
      next: () => {
        if (this.embeddedMode) {
          this.router.navigate(['/settings'], {queryParams: {intent: 'reauth'}}).then((r) => r);
        } else {
          this.router.navigate(['/home']).then((r) => r);
        }
        this.close.emit();
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Login failed', {status: 'error'}).subscribe();
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
      this.alertService.open('Please enter your email address', {status: 'error'}).subscribe();
      return;
    }
    this.authService.forgotPassword(emailValue).subscribe({
      next: (response) => {
        this.alertService.open(response.message || 'Password reset link sent!', {status: 'success'}).subscribe();
      },
      error: (error) => {
        this.alertService
          .open(error.error.message || 'Failed to send password reset link', {status: 'error'})
          .subscribe();
      },
    });
  }

  // should be defined as an arrow function to access 'this'
  onSocialLogin = (provider: string) => {
    console.log('cdr', this.cdr);
    console.log(this);
    console.log('Social login with', provider);

    if (provider === 'local') {
      this.showSeparatorAndForm = !this.showSeparatorAndForm;
      this.cdr.markForCheck();
      console.log('Local login');
      console.log(this.showSeparatorAndForm);
      return;
    }

    this.isRotating = true;
    const providerUrls: { [key: string]: string } = {
      google: AppConstants.GOOGLE_AUTH_URL_WITH_REDIRECT_TO,
      apple: AppConstants.APPLE_AUTH_URL_WITH_REDIRECT_TO,
    };

    let url = providerUrls[provider] + (this.embeddedMode ? '/settings?intent=' + this.intent : '/home');
    console.log(url)
    window.location.href = url;
  };

  // Hovering over the greeting
  onMouseEnter() {
    this.isHovering = true;
  }

  onMouseLeave() {
    this.isHovering = false;
  }
}
