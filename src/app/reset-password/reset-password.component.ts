import { Component, OnInit } from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import { AuthService } from '../auth/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import {TuiAlertService, TuiButtonModule, TuiErrorModule} from '@taiga-ui/core';
import {AsyncPipe} from "@angular/common";
import {TuiFieldErrorPipeModule, TuiInputPasswordModule} from "@taiga-ui/kit";

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
  imports: [
    ReactiveFormsModule,
    AsyncPipe,
    TuiErrorModule,
    TuiFieldErrorPipeModule,
    TuiInputPasswordModule,
    TuiButtonModule
  ],
  standalone: true
})
export class ResetPasswordComponent implements OnInit {
  resetForm: FormGroup;
  token: string = '';

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private alertService: TuiAlertService
  ) {
    this.resetForm = new FormGroup({
      newPassword: new FormControl('', [Validators.required, Validators.minLength(6)])
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
      if (!this.token) {
        this.alertService.open('No token provided', {status: "error"}).subscribe();
        this.router.navigate(['/auth']);
      }
    });
  }

  onSubmit() {
    if (this.resetForm.valid) {
      const newPassword = this.resetForm.get('newPassword')?.value;
      this.authService.resetPassword(this.token, newPassword).subscribe({
        next: () => {
          this.alertService.open('Password reset successfully!', {status: "success"}).subscribe();
          this.router.navigate(['/auth']);
        },
        error: error => {
          this.alertService.open(error.error.message || 'Password reset failed', {status: "error"}).subscribe();
        }
      });
    }
  }
}
