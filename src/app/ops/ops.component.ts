import {Component, inject} from '@angular/core';
import {DatePipe} from '@angular/common';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {finalize} from 'rxjs';
import {getErrorMessage} from '../shared/http-error';
import {RecentAuthGuardService} from '../authentication/auth/recent-auth-guard.service';
import {RecentAuthGuardComponent} from '../shared/recent-auth-guard/recent-auth-guard.component';
import {
  AccessGrantRequest,
  BROADCAST_CHANNELS,
  BroadcastLanguage,
  Entitlement,
  OpsService,
  OpsUserSummary,
} from './ops.service';

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
  protected readonly broadcastChannels = BROADCAST_CHANNELS;
  protected readonly maxAnnouncementLength = 5000;

  protected lookupForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected form = this.fb.nonNullable.group({
    userId: ['', [Validators.required]],
    entitlement: [Entitlement.PREMIUM, [Validators.required]],
    expiresAt: [''],
    reason: ['', [Validators.required]],
  });

  protected announcementForm = this.fb.nonNullable.group({
    language: ['' as BroadcastLanguage | '', []],
    text: ['', [Validators.required, Validators.maxLength(5000)]],
  });

  protected lookupResult: OpsUserSummary | null = null;
  protected lookingUp = false;
  protected submitting = false;
  protected publishing = false;
  /** A post is irreversible and lands in front of everyone in the room, so it asks twice. */
  protected awaitingPublishConfirmation = false;

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

  protected onPublish(): void {
    if (this.publishing || this.announcementForm.invalid) {
      this.announcementForm.markAllAsTouched();
      return;
    }

    if (!this.awaitingPublishConfirmation) {
      this.awaitingPublishConfirmation = true;
      return;
    }

    this.awaitingPublishConfirmation = false;
    this.publishing = true;
    this.recentAuthGuardService.guardAction(() => this.performPublish(), false, 'Publish');
  }

  protected onCancelPublish(): void {
    this.awaitingPublishConfirmation = false;
  }

  protected get selectedChannelLabel(): string {
    const language = this.announcementForm.controls.language.value;
    return this.broadcastChannels.find(channel => channel.value === language)?.label ?? '';
  }

  private performPublish(): void {
    const {language, text} = this.announcementForm.getRawValue();
    const channelLabel = this.selectedChannelLabel;

    this.opsService.publishAnnouncement({language: language || null, text})
      .pipe(finalize(() => this.publishing = false))
      .subscribe({
        next: () => {
          this.notify(`Published to ${channelLabel}.`, 'positive');
          this.announcementForm.controls.text.reset('');
        },
        error: (error) => this.notify(getErrorMessage(error, 'Failed to publish the announcement'), 'negative'),
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
