import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {TuiAlertService} from '@taiga-ui/core';
import {AuthService} from '../auth/auth.service';
import {ParticlesService} from '../../services/particles.service';
import {combineLatest, of, timer} from 'rxjs';
import {catchError, switchMap, tap} from 'rxjs/operators';
import {NgxParticlesModule} from "@tsparticles/angular";
import {AsyncPipe, NgClass, NgIf, NgOptimizedImage} from "@angular/common";

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
  private readonly REDIRECT_TIMEOUT = 3000;  // Time to wait before redirecting after verification completes
  private readonly MINIMUM_ROTATE_TIME = 2000;  // Minimum rotate time for animation

  message: string = 'Verifying...';
  pendingMessage: string = '';  // Use this to store the final message until both processes complete
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
    this.particlesService.initializeParticles();

    // Minimum timer to keep rotating for at least 1 second
    const minRotateTimer$ = timer(this.MINIMUM_ROTATE_TIME);

    // Extract the token from the URL parameters
    this.route.queryParams.pipe(
      switchMap((params) => {
        const token = params['token'];
        if (token) {
          // API call to verify the email
          const verifyEmail$ = this.authService.verifyEmail(token).pipe(
            tap(() => {
              this.verificationSuccess = true;
              this.pendingMessage = 'Email verified successfully!';  // Set the final message but don't display yet
            }),
            catchError(error => {
              // Handle verification error
              this.verificationSuccess = false;
              this.pendingMessage = error.error.message || 'Email verification failed';  // Set the error message
              return of(null);  // Return a value to complete the observable
            })
          );

          // Combine the API call and the timer to wait for both
          return combineLatest([minRotateTimer$, verifyEmail$]);
        } else {
          // No token provided, set error message
          this.verificationSuccess = false;
          this.pendingMessage = 'No token provided';
          return combineLatest([minRotateTimer$, of(null)]);
        }
      })
    ).subscribe({
      next: () => {
        // Once both the timer and the API call complete, stop the rotation and show the final message
        this.stopRotation();
        this.message = this.pendingMessage;  // Update the message at the same time the rotation stops
        this.displayResult(this.verificationSuccess ? 'success' : 'error');
      },
      error: (error) => {
        // If an error occurs while fetching query params, show a generic error message
        console.error('Error fetching query params:', error);
        this.pendingMessage = 'Verification process failed';
        this.verificationSuccess = false;
        this.stopRotation();
        this.message = this.pendingMessage;
        this.displayResult('error');
      }
    });
  }

  private stopRotation() {
    this.isRotating = false;
  }

  private displayResult(result: 'success' | 'error') {
    this.verificationCompleted = true;
    this.alertService.open(this.message, {status: result}).subscribe();
    if (result === 'success') {
      // Set a minimum display time before redirecting
      timer(this.REDIRECT_TIMEOUT).subscribe(() => {
        this.router.navigate(['/auth'], {fragment: 'sign-in'}).then();
      });
    }
  }
}
