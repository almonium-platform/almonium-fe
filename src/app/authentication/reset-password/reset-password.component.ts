import {TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {Component, OnInit} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {AuthService} from '../auth/auth.service';
import {ActivatedRoute, Router} from '@angular/router';
import {
  TuiAlertService,
  TuiError,
  TuiIcon,
  TuiTextfieldComponent,
  TuiTextfieldDirective,
  TuiTextfieldOptionsDirective
} from '@taiga-ui/core';
import {TUI_VALIDATION_ERRORS, TuiFieldErrorPipe, TuiPassword} from '@taiga-ui/kit';
import {NgxParticlesModule} from '@tsparticles/angular';
import {AsyncPipe} from '@angular/common';
import {ParticlesComponent} from "../../shared/particles/particles.component";
import {AppConstants} from "../../app.constants";

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.less'],
  imports: [
    ReactiveFormsModule,
    TuiError,
    TuiFieldErrorPipe,
    NgxParticlesModule,
    TuiTextfieldControllerModule,
    AsyncPipe,
    ParticlesComponent,
    TuiIcon,
    TuiPassword,
    TuiTextfieldComponent,
    TuiTextfieldDirective,
    TuiTextfieldOptionsDirective,
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
  resetForm: FormGroup;
  token: string = '';

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private alertService: TuiAlertService,
  ) {
    this.resetForm = new FormGroup({
      newPassword: new FormControl('', [Validators.required, Validators.minLength(AppConstants.MIN_PASSWORD_LENGTH)]),
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.token = params['token'];
      if (!this.token) {
        this.alertService.open('No token provided', {appearance: 'error'}).subscribe();
        this.router.navigate(['/auth']).then(r => r);
      }
    });
  }

  onSubmit() {
    if (this.resetForm.valid) {
      const newPassword = this.resetForm.get('newPassword')?.value;
      this.authService.resetPassword(this.token, newPassword).subscribe({
        next: () => {
          this.alertService.open('Password reset successfully!', {appearance: 'success'}).subscribe();
          this.router.navigate(['/auth']).then(r => r);
        },
        error: (error) => {
          this.alertService.open(error.error.message || 'Password reset failed', {appearance: 'error'}).subscribe();
        },
      });
    }
  }
}
