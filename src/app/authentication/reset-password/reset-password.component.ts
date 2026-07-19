import {Component, OnInit} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {AuthService} from '../auth/auth.service';
import {ActivatedRoute, Router} from '@angular/router';
import { TuiError, TuiIcon, TuiTextfieldComponent, TuiTextfieldOptionsDirective, TuiNotificationService, TUI_VALIDATION_ERRORS } from '@taiga-ui/core';
import {TuiPassword} from '@taiga-ui/kit';
import {NgxParticlesModule} from '@tsparticles/angular';
import {ParticlesComponent} from "../../shared/particles/particles.component";
import {AppConstants} from "../../app.constants";
import {ButtonComponent} from "../../shared/button/button.component";
import {BehaviorSubject, finalize} from "rxjs";

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.less'],
  imports: [
    ReactiveFormsModule,
    TuiError,
    NgxParticlesModule,
    ParticlesComponent,
    TuiIcon,
    TuiPassword,
    TuiTextfieldComponent,
    TuiTextfieldOptionsDirective,
    ButtonComponent,
  ],
  providers: [
    {
      provide: TUI_VALIDATION_ERRORS,
      useValue: {
        required: 'Value is required',
        minlength: ({requiredLength, actualLength}: {
          requiredLength: number;
          actualLength: number;
        }) => `Password is too short: ${actualLength}/${requiredLength} characters`,
      },
    },
  ]
})
export class ResetPasswordComponent implements OnInit {
  protected resetForm: FormGroup;
  private token: string = '';

  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private alertService: TuiNotificationService,
  ) {
    this.resetForm = new FormGroup({
      newPassword: new FormControl('', [Validators.required, Validators.minLength(AppConstants.MIN_PASSWORD_LENGTH)]),
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.token = params['oobCode'] || params['token'];
      if (!this.token) {
        this.alertService.open('No token provided', {appearance: 'negative'}).subscribe();
        this.router.navigate(['/auth']).then();
      }

      // Preemptively validate the token
      this.authService.validateResetPasswordToken(this.token).subscribe({
        next: (isValid) => {
          if (!isValid) {
            this.showErrorAndRedirect('Invalid or expired reset token');
          }
        },
        error: () => this.showErrorAndRedirect('Failed to validate reset token'),
      });
    });
  }

  onSubmit() {
    if (this.resetForm.valid) {
      this.loadingSubject$.next(true);

      const newPassword = this.resetForm.get('newPassword')?.value;
      this.authService.resetPassword(this.token, newPassword)
        .pipe(finalize(() => this.loadingSubject$.next(false)))
        .subscribe({
          next: () => {
            this.alertService.open('Password reset successfully!', {appearance: 'positive'}).subscribe();
            this.router.navigate(['/auth']).then();
          },
          error: (error) => {
            const message = error.error.message;
            this.showErrorAndRedirect(message);
          },
        });
    }
  }

  private showErrorAndRedirect(message: string) {
    this.alertService.open(message, {appearance: 'negative'}).subscribe();
    this.router.navigate(['/auth']).then();
  }
}
