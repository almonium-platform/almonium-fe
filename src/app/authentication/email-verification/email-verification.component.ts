import {logger} from "../../shared/logger";
import {getErrorMessage} from '../../shared/http-error';
import {TuiNotificationService} from "@taiga-ui/core/components";
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {AuthService} from '../auth/auth.service';
import {combineLatest, of, timer} from 'rxjs';
import {catchError, switchMap, tap} from 'rxjs/operators';
import {NgxParticlesModule} from "@tsparticles/angular";
import {NgClass} from "@angular/common";
import {ParticlesComponent} from "../../shared/particles/particles.component";
import {ButtonComponent} from "../../shared/button/button.component";
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-email-verification',
  templateUrl: './email-verification.component.html',
  styleUrls: ['./email-verification.component.less'],
  imports: [
    NgxParticlesModule,
    NgClass,
    ParticlesComponent,
    ButtonComponent
  ]
})
export class EmailVerificationComponent implements OnInit {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  router = inject(Router);
  private alertService = inject(TuiNotificationService);
  private destroyRef = inject(DestroyRef);

  private readonly REDIRECT_TIMEOUT = 3000;  // Time to wait before redirecting after verification completes
  private readonly MINIMUM_ROTATE_TIME = 2000;  // Minimum rotate time for animation

  message = 'Verifying...';
  pendingMessage = '';  // Use this to store the final message until both processes complete
  verificationCompleted = false;
  verificationSuccess = false;
  isRotating = true;
  isChangeEmailRoute = false;

  ngOnInit(): void {
    // Minimum timer to keep rotating for at least 1 second
    const minRotateTimer$ = timer(this.MINIMUM_ROTATE_TIME);
    this.isChangeEmailRoute = this.router.url.includes('/change-email'); // Determine purpose by route

    // Extract the token from the URL parameters
    this.route.queryParamMap.pipe(
      switchMap((params) => {
        const token = params.get('oobCode') ?? params.get('token');
        if (token) {
          const verification$ = this.isChangeEmailRoute
            ? this.authService.changeEmail(token)
            : this.authService.verifyEmail(token);

          return combineLatest([minRotateTimer$, verification$.pipe(
            tap(() => {
              this.verificationSuccess = true;
              this.pendingMessage = this.isChangeEmailRoute
                ? 'Email changed successfully!'
                : 'Email verified successfully!';
            }),
            catchError(error => {
              this.verificationSuccess = false;
              this.pendingMessage = getErrorMessage(error, `${this.isChangeEmailRoute ? 'Email change' : 'Email verification'} failed`);
              return of(null);
            })
          )]);
        } else {
          // No token provided, set error message
          this.verificationSuccess = false;
          this.pendingMessage = 'No token provided';
          return combineLatest([minRotateTimer$, of(null)]);
        }
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        // Once both the timer and the API call complete, stop the rotation and show the final message
        this.stopRotation();
        this.message = this.pendingMessage;  // Update the message at the same time the rotation stops
        this.displayResult(this.verificationSuccess ? 'success' : 'error');
      },
      error: (error) => {
        // If an error occurs while fetching query params, show a generic error message
        logger.error('Error fetching query params:', error);
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
    this.alertService.open(this.message, {
      appearance: result === 'success' ? 'positive' : 'negative',
    }).subscribe();
    if (result === 'success') {
      // Set a minimum display time before redirecting
      timer(this.REDIRECT_TIMEOUT).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        if (this.isChangeEmailRoute) {
          void this.router.navigate(['/logout']).then();
          // Logout will redirect to /auth for unauthenticated users,
          // and will clear outdated authentication data for authenticated users
        } else {
          void this.router.navigate(['/settings/auth']).then();
          // Redirect to settings page after verification for authenticated users
          // (it's secured by the AuthGuard, so unauthenticated users will be redirected to /auth)
        }
      });
    }
  }
}
