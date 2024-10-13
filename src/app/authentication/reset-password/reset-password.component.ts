import {Component, OnInit} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {AuthService} from '../auth/auth.service';
import {ActivatedRoute, Router} from '@angular/router';
import {TuiAlertService, TuiButtonModule, TuiErrorModule, TuiTextfieldControllerModule} from '@taiga-ui/core';
import {TUI_VALIDATION_ERRORS, TuiFieldErrorPipeModule, TuiInputPasswordModule} from '@taiga-ui/kit';
import {ParticlesService} from '../../services/particles.service';
import {NgxParticlesModule} from '@tsparticles/angular';
import {AsyncPipe, NgIf} from '@angular/common';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.less'],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TuiErrorModule,
    TuiFieldErrorPipeModule,
    TuiInputPasswordModule,
    TuiButtonModule,
    NgxParticlesModule,
    TuiTextfieldControllerModule,
    AsyncPipe,
    NgIf,
  ],
  providers: [
    {
      provide: TUI_VALIDATION_ERRORS,
      useValue: {
        required: 'Value is required',
        minlength: ({requiredLength, actualLength}: { requiredLength: number; actualLength: number }) =>
          `Password is too short: ${actualLength}/${requiredLength} characters`,
      },
    },
  ],
})
export class ResetPasswordComponent implements OnInit {
  resetForm: FormGroup;
  token: string = '';
  id = 'tsparticles';
  particlesOptions$ = this.particlesService.particlesOptions$;

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private alertService: TuiAlertService,
    public particlesService: ParticlesService
  ) {
    this.resetForm = new FormGroup({
      newPassword: new FormControl('', [Validators.required, Validators.minLength(6)]),
    });
  }

  ngOnInit(): void {
    this.particlesService.initializeParticles();

    this.route.queryParams.subscribe((params) => {
      this.token = params['token'];
      if (!this.token) {
        this.alertService.open('No token provided', {status: 'error'}).subscribe();
        this.router.navigate(['/auth']).then(r => r);
      }
    });
  }

  onSubmit() {
    if (this.resetForm.valid) {
      const newPassword = this.resetForm.get('newPassword')?.value;
      this.authService.resetPassword(this.token, newPassword).subscribe({
        next: () => {
          this.alertService.open('Password reset successfully!', {status: 'success'}).subscribe();
          this.router.navigate(['/auth']).then(r => r);
        },
        error: (error) => {
          this.alertService.open(error.error.message || 'Password reset failed', {status: 'error'}).subscribe();
        },
      });
    }
  }
}
