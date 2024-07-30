import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {TuiAlertService} from '@taiga-ui/core';
import {AuthService} from "../auth/auth.service";

@Component({
  selector: 'app-email-verification',
  template: `
    <div class="verification-container">
      <h1>Email Verification</h1>
      <p>{{ message }}</p>
    </div>`,
  standalone: true,
})
export class EmailVerificationComponent implements OnInit {
  message: string = 'Verifying...';

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private alertService: TuiAlertService
  ) {
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      if (token) {
        this.authService.verifyEmail(token).subscribe({
          next: () => {
            this.message = 'Email verified successfully!';
            this.alertService.open(this.message, {status: 'success'}).subscribe();
            setTimeout(() => this.router.navigate(['/auth']), 3000);
          },
          error: error => {
            this.message = error.error.message || 'Email verification failed';
            this.alertService.open(this.message, {status: 'error'}).subscribe();
          }
        });
      } else {
        this.message = 'No token provided';
      }
    });
  }
}
