import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {TuiAlertService} from '@taiga-ui/core';
import {AuthService} from '../auth/auth.service';
import {ParticlesService} from '../services/particles.service';
import {AsyncPipe, NgClass, NgIf, NgOptimizedImage} from "@angular/common";
import {NgxParticlesModule} from "@tsparticles/angular";

@Component({
  selector: 'app-email-verification',
  templateUrl: './email-verification.component.html',
  styleUrls: ['./email-verification.component.less'],
  standalone: true,
  imports: [
    NgxParticlesModule,
    AsyncPipe,
    NgIf,
    NgClass,
    NgOptimizedImage
  ],
})
export class EmailVerificationComponent implements OnInit {
  private readonly REDIRECT_TIMEOUT = 3000;
  private readonly TOKEN_VERIFICATION_TIMEOUT = 3000;

  message: string = 'Verifying...';
  verificationCompleted: boolean = false;
  verificationSuccess: boolean = false;
  isRotating: boolean = true;

  id = 'tsparticles';
  particlesOptions$ = this.particlesService.particlesOptions$;

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    public router: Router,
    private alertService: TuiAlertService,
    public particlesService: ParticlesService
  ) {
  }

  ngOnInit(): void {
    // Initialize particles
    this.particlesService.initParticles();
    this.particlesService.loadParticlesOptions();

    // Start the verification process
    setTimeout(() => this.route.queryParams.subscribe({
      next: (params) => {
        const token = params['token'];
        if (token) {
          this.authService.verifyEmail(token).subscribe({
            next: () => {
              this.verificationSuccess = true;
              this.message = 'Email verified successfully!';
              this.stopRotation();
              this.displayResult('success');
            },
            error: (error) => {
              this.verificationSuccess = false;
              this.message = error.error.message || 'Email verification failed';
              this.stopRotation();
              this.displayResult('error');
            },
          });
        } else {
          this.verificationSuccess = false;
          this.message = 'No token provided';
          this.stopRotation();
          this.displayResult('error');
        }
      },
      error: (error) => {
        console.error('Error fetching query params:', error);
        this.stopRotation();
      },
    }), this.TOKEN_VERIFICATION_TIMEOUT);
  }

  private stopRotation() {
    this.isRotating = false;
  }

  private displayResult(result: 'success' | 'error') {
    this.verificationCompleted = true;
    this.alertService.open(this.message, {status: result}).subscribe();
    if (result === 'success') {
      setTimeout(() => this.router.navigate(['/auth'], {fragment: 'sign-in'}), this.REDIRECT_TIMEOUT);
    }
  }
}
