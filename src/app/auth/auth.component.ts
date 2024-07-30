import {ChangeDetectionStrategy, Component} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {TUI_VALIDATION_ERRORS, TuiFieldErrorPipeModule, TuiInputModule, TuiInputPasswordModule} from "@taiga-ui/kit";
import {TuiAlertService, TuiButtonModule, TuiErrorModule} from "@taiga-ui/core";
import {AsyncPipe, NgIf} from "@angular/common";
import {AuthService} from './auth.service';
import {Router} from "@angular/router";
import {AppConstants} from "../app.constants";

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
  ],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: TUI_VALIDATION_ERRORS,
      useValue: {
        required: 'Value is required',
        email: 'Invalid email address'
      },
    },
  ],
})
export class AuthComponent {
  greetings: string[] = [
    'Bonjour', 'Namaste', 'Привіт', 'Hello', 'Hola', 'Ciao', 'Konnichiwa', 'Guten Tag',
    'Olá', 'Annyeong', 'Salaam', 'Здравствуйте',
    'مرحبا', 'שלום', 'こんにちは', '안녕하세요', 'สวัสดี', 'Merhaba', 'Shalom', 'Sawubona',
    'Hallo', 'Hej', 'Ahoj', 'Szia', 'Salam', 'Yassas', 'Selamat', 'Xin chào',
    'Dzień dobry', 'Sveiki', 'Tere', 'God dag', 'Kamusta', 'Sawa dee', 'Marhaba'
  ];
  currentGreeting: string = this.greetings[0];
  isSignUp: boolean = false;

  authForm = new FormGroup({
    emailValue: new FormControl('', [Validators.required, Validators.email]),
    passwordValue: new FormControl('', Validators.required),
  });

  toggleSignUp() {
    this.isSignUp = !this.isSignUp;
  }

  constructor(private authService: AuthService,
              private alertService: TuiAlertService,
              private router: Router
  ) {
    setInterval(() => {
      this.currentGreeting = this.greetings[Math.floor(Math.random() * this.greetings.length)];
    }, 1000);
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
