import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {TUI_VALIDATION_ERRORS, TuiFieldErrorPipeModule, TuiInputModule, TuiInputPasswordModule} from "@taiga-ui/kit";
import {
  TuiAlertService,
  TuiButtonModule,
  TuiErrorModule,
  TuiLinkModule,
  TuiTextfieldControllerModule
} from "@taiga-ui/core";
import {AsyncPipe, NgIf, NgOptimizedImage} from "@angular/common";
import {AuthService} from './auth.service';
import {ActivatedRoute, Router} from "@angular/router";
import {AppConstants} from '../app.constants';
import {environment} from "../../environments/environment";

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
  ],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.less'],
  providers: [
    {
      provide: TUI_VALIDATION_ERRORS,
      useValue: {
        required: 'Value is required',
        email: 'Invalid email address',
        minlength: ({requiredLength, actualLength}: { requiredLength: number, actualLength: number }) =>
          `Password is too short: ${actualLength}/${requiredLength} characters`
      }
    },
  ],
})
export class AuthComponent implements OnInit {
  greetings: string[] = [
    'Bonjour', 'Namaste', 'Привіт', 'Hello', 'Hola', 'Ciao', 'Konnichiwa', 'Guten Tag',
    'Olá', 'Annyeong', 'Salaam', 'Здравствуйте',
    'مرحبا', 'שלום', 'こんにちは', '안녕하세요', 'สวัสดี', 'Merhaba', 'Shalom', 'Sawubona',
    'Hallo', 'Hej', 'Ahoj', 'Szia', 'Salam', 'Yassas', 'Selamat', 'Xin chào',
    'Dzień dobry', 'Sveiki', 'Tere', 'God dag', 'Kamusta', 'Sawa dee', 'Marhaba'
  ];
  currentGreeting: string = this.greetings[0];
  isSignUp: boolean = false;
  minimumPasswordLength: number = 6;

  private readonly TERMS_OF_USE_PATH = '/terms-of-use';
  private readonly PRIVACY_POLICY_PATH = '/privacy-policy';
  termsOfUseUrl: string = `${environment.feUrl}${this.TERMS_OF_USE_PATH}`;
  privacyPolicyUrl: string = `${environment.feUrl}${this.PRIVACY_POLICY_PATH}`;

  authForm = new FormGroup({
    emailValue: new FormControl('', [Validators.required, Validators.email]),
    passwordValue: new FormControl('', [Validators.required, Validators.minLength(this.minimumPasswordLength)]),
  });

  constructor(
    private authService: AuthService,
    private alertService: TuiAlertService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {
    setInterval(() => {
      this.currentGreeting = this.greetings[Math.floor(Math.random() * this.greetings.length)];
      this.cdr.detectChanges();
    }, 2000);
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      if (token) {
        this.authService.storeToken(token);
        this.router.navigate(['/home']).then(r => r);
      }
    });
  }

  onSubmit() {
    if (this.authForm.valid) {
      const emailValue = this.authForm.get('emailValue')?.value!;
      const passwordValue = this.authForm.get('passwordValue')?.value!;

      if (this.isSignUp) {
        this.authService.register(emailValue, passwordValue).subscribe({
          next: response => {
            this.alertService.open(response.message || 'Next step, verify your email!', {status: 'success'}).subscribe();
          },
          error: error => {
            this.alertService.open(error.error.message || 'Registration failed', {status: 'error'}).subscribe();
          }
        });
      } else {
        this.authService.login(emailValue, passwordValue).subscribe({
          next: response => {
            this.authService.storeToken(response.accessToken);
            this.router.navigate(['/home']).then(r => r);
          },
          error: error => {
            this.alertService.open(error.error.message || 'Login failed', {status: 'error'}).subscribe();
          }
        });
      }
    }
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
      next: response => {
        this.alertService.open(response.message || 'Password reset link sent!', {status: 'success'}).subscribe();
      },
      error: error => {
        this.alertService.open(error.error.message || 'Failed to send password reset link', {status: 'error'}).subscribe();
      }
    });
  }

  onSocialLogin(provider: string) {
    let url = '';
    switch (provider) {
      case 'google':
        url = AppConstants.GOOGLE_AUTH_URL;
        break;
      case 'facebook':
        url = AppConstants.FACEBOOK_AUTH_URL;
        break;
      case 'apple':
        url = AppConstants.APPLE_AUTH_URL;
        break;
    }
    window.location.href = url;
  }
}
