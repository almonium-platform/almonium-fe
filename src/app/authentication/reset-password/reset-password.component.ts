import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {AuthService} from '../auth/auth.service';
import {ActivatedRoute, Router} from '@angular/router';
import {TuiError, TuiIcon, TuiNotificationService, TuiTextfieldComponent, TuiTextfieldOptionsDirective} from '@taiga-ui/core/components';
import {TUI_VALIDATION_ERRORS} from '@taiga-ui/core/tokens';
import {TuiPassword} from '@taiga-ui/kit/directives';
import {NgxParticlesModule} from '@tsparticles/angular';
import {ParticlesComponent} from "../../shared/particles/particles.component";
import {AppConstants} from "../../app.constants";
import {ButtonComponent} from "../../shared/button/button.component";
import {BehaviorSubject, finalize} from "rxjs";
import {getErrorMessage} from '../../shared/http-error';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

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
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private alertService = inject(TuiNotificationService);
  private destroyRef = inject(DestroyRef);

  protected resetForm: FormGroup<{newPassword: FormControl<string>}>;
  private token = '';

  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();

  constructor() {
    this.resetForm = new FormGroup({
      newPassword: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.minLength(AppConstants.MIN_PASSWORD_LENGTH)]}),
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.token = params.get('oobCode') ?? params.get('token') ?? '';
      if (!this.token) {
        this.alertService.open('No token provided', {appearance: 'negative'}).subscribe();
        void this.router.navigate(['/auth']).then();
      }

      // Preemptively validate the token
      this.authService.validateResetPasswordToken(this.token).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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

      const newPassword = this.resetForm.controls.newPassword.value ?? '';
      this.authService.resetPassword(this.token, newPassword)
        .pipe(
          finalize(() => this.loadingSubject$.next(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: () => {
            this.alertService.open('Password reset successfully!', {appearance: 'positive'}).subscribe();
            void this.router.navigate(['/auth']).then();
          },
          error: (error) => {
            const message = getErrorMessage(error, 'Password reset failed');
            this.showErrorAndRedirect(message);
          },
        });
    }
  }

  private showErrorAndRedirect(message: string) {
    this.alertService.open(message, {appearance: 'negative'}).subscribe();
    void this.router.navigate(['/auth']).then();
  }
}
