import {Component, inject} from '@angular/core';
import {DatePipe} from '@angular/common';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {finalize} from 'rxjs';
import {getErrorMessage} from '../shared/http-error';
import {RecentAuthGuardService} from '../authentication/auth/recent-auth-guard.service';
import {RecentAuthGuardComponent} from '../shared/recent-auth-guard/recent-auth-guard.component';
import {AccessGrantRequest, Entitlement, OpsService, OpsUserSummary} from './ops.service';

@Component({
  selector: 'app-ops',
  imports: [ReactiveFormsModule, RecentAuthGuardComponent, DatePipe],
  templateUrl: './ops.component.html',
  styleUrl: './ops.component.less',
})
export class OpsComponent {
  private fb = inject(FormBuilder);
  private opsService = inject(OpsService);
  private recentAuthGuardService = inject(RecentAuthGuardService);
  private alertService = inject(TuiNotificationService);

  protected readonly entitlements = Object.values(Entitlement);

  protected lookupForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected form = this.fb.nonNullable.group({
    userId: ['', [Validators.required]],
    entitlement: [Entitlement.PREMIUM, [Validators.required]],
    expiresAt: [''],
    reason: ['', [Validators.required]],
  });

  protected lookupResult: OpsUserSummary | null = null;
  protected lookingUp = false;
  protected submitting = false;

  protected onLookup(): void {
    if (this.lookupForm.invalid) {
      this.lookupForm.markAllAsTouched();
      return;
    }
    const email = this.lookupForm.controls.email.value;
    this.lookingUp = true;
    this.opsService.findUserByEmail(email)
      .pipe(finalize(() => this.lookingUp = false))
      .subscribe({
        next: (result) => {
          this.lookupResult = result;
          this.form.controls.userId.setValue(result.id);
        },
        error: (error) => {
          this.lookupResult = null;
          this.notify(getErrorMessage(error, 'No user found with that email'), 'negative');
        },
      });
  }

  protected onGrant(): void {
    if (this.submitting || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    // Set before the async guardAction round-trip resolves, otherwise a double-click fires two
    // overlapping requests against the same AccessGrant row and the second loses an optimistic-lock race.
    this.submitting = true;
    this.recentAuthGuardService.guardAction(() => this.performGrant());
  }

  protected onRevoke(): void {
    const userId = this.form.controls.userId.value;
    if (this.submitting || !userId) {
      this.form.controls.userId.markAsTouched();
      return;
    }
    this.submitting = true;
    this.recentAuthGuardService.guardAction(() => this.performRevoke(userId));
  }

  private performGrant(): void {
    const {userId, entitlement, expiresAt, reason} = this.form.getRawValue();
    const request: AccessGrantRequest = {
      entitlement,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      reason,
    };

    this.opsService.grantAccess(userId, request)
      .pipe(finalize(() => this.submitting = false))
      .subscribe({
        next: () => {
          this.notify(`Access grant updated for ${userId}.`, 'positive');
          this.refreshLookup(userId);
        },
        error: (error) => this.notify(getErrorMessage(error, 'Failed to update access grant'), 'negative'),
      });
  }

  private performRevoke(userId: string): void {
    this.opsService.revokeAccess(userId)
      .pipe(finalize(() => this.submitting = false))
      .subscribe({
        next: () => {
          this.notify(`Access grant revoked for ${userId}.`, 'positive');
          this.refreshLookup(userId);
        },
        error: (error) => this.notify(getErrorMessage(error, 'Failed to revoke access grant'), 'negative'),
      });
  }

  private refreshLookup(userId: string): void {
    if (this.lookupResult?.id !== userId) {
      return;
    }
    this.opsService.findUserByEmail(this.lookupResult.email).subscribe((result) => this.lookupResult = result);
  }

  private notify(message: string, appearance: 'positive' | 'negative'): void {
    this.alertService.open(message, {appearance}).subscribe();
  }
}
