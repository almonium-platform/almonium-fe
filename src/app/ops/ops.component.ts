import {Component, OnInit, inject} from '@angular/core';
import {CurrencyPipe, DatePipe, DecimalPipe} from '@angular/common';
import {FormBuilder, FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {finalize} from 'rxjs';
import {getErrorMessage} from '../shared/http-error';
import {RecentAuthGuardService} from '../authentication/auth/recent-auth-guard.service';
import {RecentAuthGuardComponent} from '../shared/recent-auth-guard/recent-auth-guard.component';
import {
  AccessGrantRequest,
  FirebaseAccountSummary,
  BROADCAST_CHANNELS,
  BroadcastLanguage,
  Entitlement,
  OpsService,
  OpsUserSummary,
  SpendActualLine,
  SpendEstimatedLine,
  SpendReport,
} from './ops.service';

/** The ledgers name features by their internal purpose; the page names them for a reader. */
const SPEND_FEATURE_LABELS: Record<string, string> = {
  chat: 'Almo chat',
  translation: 'Book translation',
  literary_translation: 'Book translation',
  alignment_adjudication: 'Book alignment',
  import_metadata: 'Import metadata',
};

/** Charges summed over the window for one line item of one project. */
export interface SpendLineItemTotal {
  projectId: string;
  lineItem: string;
  usd: number;
}

@Component({
  selector: 'app-ops',
  imports: [ReactiveFormsModule, RecentAuthGuardComponent, DatePipe, DecimalPipe, CurrencyPipe],
  templateUrl: './ops.component.html',
  styleUrl: './ops.component.less',
})
export class OpsComponent implements OnInit {
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

  protected limitsForm = this.fb.nonNullable.group({
    userId: ['', [Validators.required]],
    reason: [''],
  });

  protected announcementForm = this.fb.nonNullable.group({
    language: new FormControl<BroadcastLanguage | ''>('', {nonNullable: true}),
    text: ['', [Validators.required, Validators.maxLength(5000)]],
  });

  protected lookupResult: OpsUserSummary | null = null;
  protected purgeForm = this.fb.nonNullable.group({
    confirmation: ['', [Validators.required]],
  });
  protected purgePhrase: string | null = null;
  protected purging = false;

  protected firebaseForm = this.fb.nonNullable.group({
    confirmation: ['', [Validators.required]],
    includeOperator: [false],
  });
  protected firebaseLookupForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });
  protected firebaseAccount: FirebaseAccountSummary | null = null;
  protected firebaseLookupError = '';
  protected lookingUpFirebase = false;

  protected firebaseProject: string | null = null;
  protected firebaseUserCount = 0;
  protected purgingFirebase = false;

  protected orphans: string[] | null = null;
  protected scanningOrphans = false;
  protected purgingOrphans = false;
  protected awaitingPurgeConfirmation = false;
  protected syncingArtwork = false;
  protected provisioningAccounts = false;

  protected readonly spendWindows = [7, 30, 90];
  protected spendDays = 30;
  protected spend: SpendReport | null = null;
  protected spendByLineItem: SpendLineItemTotal[] = [];
  protected spendByDay: {day: string; usd: number}[] = [];
  protected loadingSpend = false;
  protected spendError = '';

  protected lookingUp = false;
  protected submitting = false;
  protected resettingQuota = false;
  protected clearingSwitchCooldown = false;
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
          this.limitsForm.controls.userId.setValue(result.id);
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

  protected onResetImportQuota(): void {
    const {userId, reason} = this.limitsForm.getRawValue();
    if (this.resettingQuota || !userId || !reason.trim()) {
      this.limitsForm.markAllAsTouched();
      // The backend refuses a reasonless reset, so say which half is missing rather than let the
      // request come back as a bare 400.
      this.notify(userId ? 'A reason is required to reset the quota.' : 'A user ID is required.', 'negative');
      return;
    }
    // The flag goes up with the request, not before it: a dismissed identity prompt would otherwise
    // leave the button disabled with nothing on the way back to lower it. Both resets are idempotent.
    this.recentAuthGuardService.guardAction(() => this.performResetImportQuota(userId, reason.trim()), false, 'Reset');
  }

  private performResetImportQuota(userId: string, reason: string): void {
    this.resettingQuota = true;
    this.opsService.resetBookImportQuota(userId, reason)
      .pipe(finalize(() => this.resettingQuota = false))
      .subscribe({
        next: () => this.notify(`Book-import quota reset for ${userId}.`, 'positive'),
        error: (error) => this.notify(getErrorMessage(error, 'Failed to reset the book-import quota'), 'negative'),
      });
  }

  protected onResetLanguageSwitch(): void {
    const userId = this.limitsForm.controls.userId.value;
    if (this.clearingSwitchCooldown || !userId) {
      this.limitsForm.controls.userId.markAsTouched();
      return;
    }
    this.recentAuthGuardService.guardAction(() => this.performResetLanguageSwitch(userId), false, 'Clear');
  }

  private performResetLanguageSwitch(userId: string): void {
    this.clearingSwitchCooldown = true;
    this.opsService.resetActiveLanguageSwitch(userId)
      .pipe(finalize(() => this.clearingSwitchCooldown = false))
      .subscribe({
        next: () => this.notify(`Active-language switch cleared for ${userId}.`, 'positive'),
        error: (error) => this.notify(getErrorMessage(error, 'Failed to clear the switch cooldown'), 'negative'),
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
    // The flag goes up with the request, not before it: the identity prompt can be dismissed, and a
    // flag raised ahead of it would leave the button disabled with nothing on the way back to lower
    // it. Double-fires are already impossible - sending again costs another confirmation.
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
    this.publishing = true;
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

  ngOnInit(): void {
    this.loadSpend();

    // The backend names the environment in the phrase, so the console shows what it will accept
    // rather than guessing: a client pointed at a different backend than you assume is exactly the
    // mistake this is here to catch.
    this.opsService.purgeConfirmationPhrase().subscribe({
      next: ({confirmation}) => this.purgePhrase = confirmation,
      error: () => this.purgePhrase = null,
    });

    this.opsService.firebasePurgeInfo().subscribe({
      next: ({confirmation, userCount}) => {
        this.firebaseProject = confirmation;
        this.firebaseUserCount = userCount;
      },
      error: () => this.firebaseProject = null,
    });
  }

  protected onLookupFirebase(): void {
    if (this.lookingUpFirebase || this.firebaseLookupForm.invalid) {
      this.firebaseLookupForm.markAllAsTouched();
      return;
    }

    this.lookingUpFirebase = true;
    this.firebaseLookupError = '';
    this.opsService.findFirebaseAccount(this.firebaseLookupForm.controls.email.value)
      .pipe(finalize(() => this.lookingUpFirebase = false))
      .subscribe({
        next: (account) => this.firebaseAccount = account,
        error: (error) => {
          this.firebaseAccount = null;
          this.firebaseLookupError = getErrorMessage(error, 'No Firebase account with that email');
        },
      });
  }

  protected onPurgeFirebase(): void {
    if (this.purgingFirebase || this.firebaseForm.invalid) {
      this.firebaseForm.markAllAsTouched();
      return;
    }
    this.recentAuthGuardService.guardAction(() => this.performPurgeFirebase(), false, 'Erase');
  }

  private performPurgeFirebase(): void {
    const {confirmation, includeOperator} = this.firebaseForm.getRawValue();
    this.purgingFirebase = true;
    this.opsService.purgeFirebase(confirmation, includeOperator)
      .pipe(finalize(() => this.purgingFirebase = false))
      .subscribe({
        next: (response) => {
          this.notify(response.message, 'positive');
          this.firebaseForm.reset({confirmation: '', includeOperator: false});
          this.firebaseUserCount = includeOperator ? 0 : 1;
        },
        error: (error) => this.notify(getErrorMessage(error, 'Failed to empty the Firebase project'), 'negative'),
      });
  }

  protected get canPurgeFirebase(): boolean {
    return !!this.firebaseProject && this.firebaseForm.controls.confirmation.value === this.firebaseProject;
  }

  protected onPurge(): void {
    if (this.purging || this.purgeForm.invalid) {
      this.purgeForm.markAllAsTouched();
      return;
    }
    this.recentAuthGuardService.guardAction(() => this.performPurgeStream(), false, 'Erase');
  }

  private performPurgeStream(): void {
    this.purging = true;
    this.opsService.purgeStream(this.purgeForm.controls.confirmation.value)
      .pipe(finalize(() => this.purging = false))
      .subscribe({
        next: (response) => {
          this.notify(response.message, 'positive');
          this.purgeForm.reset();
          this.orphans = null;
        },
        error: (error) => this.notify(getErrorMessage(error, 'Failed to empty the Stream application'), 'negative'),
      });
  }

  protected get canPurge(): boolean {
    return !!this.purgePhrase && this.purgeForm.controls.confirmation.value === this.purgePhrase;
  }

  protected onScanOrphans(): void {
    if (this.scanningOrphans) {
      return;
    }
    this.scanningOrphans = true;
    this.opsService.findOrphanedStreamUsers()
      .pipe(finalize(() => this.scanningOrphans = false))
      .subscribe({
        next: (orphans) => this.orphans = orphans,
        error: (error) => this.notify(getErrorMessage(error, 'Failed to read the Stream user directory'), 'negative'),
      });
  }

  protected onPurgeOrphans(): void {
    if (this.purgingOrphans || !this.orphans?.length) {
      return;
    }

    if (!this.awaitingPurgeConfirmation) {
      this.awaitingPurgeConfirmation = true;
      return;
    }

    this.awaitingPurgeConfirmation = false;
    this.recentAuthGuardService.guardAction(() => this.performPurge(), false, 'Delete');
  }

  protected onCancelPurge(): void {
    this.awaitingPurgeConfirmation = false;
  }

  protected onProvisionAccounts(): void {
    if (this.provisioningAccounts) {
      return;
    }
    this.recentAuthGuardService.guardAction(() => this.performProvisionAccounts(), false, 'Rebuild');
  }

  private performProvisionAccounts(): void {
    this.provisioningAccounts = true;
    this.opsService.provisionStreamAccounts()
      .pipe(finalize(() => this.provisioningAccounts = false))
      .subscribe({
        next: (response) => this.notify(response.message, 'positive'),
        error: (error) => this.notify(getErrorMessage(error, 'Failed to rebuild the accounts'), 'negative'),
      });
  }

  protected onSyncArtwork(): void {
    if (this.syncingArtwork) {
      return;
    }
    this.recentAuthGuardService.guardAction(() => this.performSyncArtwork(), false, 'Sync');
  }

  private performPurge(): void {
    const count = this.orphans?.length ?? 0;
    this.purgingOrphans = true;
    this.opsService.deleteOrphanedStreamUsers()
      .pipe(finalize(() => this.purgingOrphans = false))
      .subscribe({
        next: () => {
          this.notify(`Deleted ${count} orphaned Stream ${count === 1 ? 'user' : 'users'}.`, 'positive');
          this.orphans = [];
        },
        error: (error) => this.notify(getErrorMessage(error, 'Failed to delete the orphaned users'), 'negative'),
      });
  }

  private performSyncArtwork(): void {
    this.syncingArtwork = true;
    this.opsService.syncSystemChannelArtwork()
      .pipe(finalize(() => this.syncingArtwork = false))
      .subscribe({
        next: () => this.notify('System channel artwork synced.', 'positive'),
        error: (error) => this.notify(getErrorMessage(error, 'Failed to sync the channel artwork'), 'negative'),
      });
  }

  private refreshLookup(userId: string): void {
    if (this.lookupResult?.id !== userId) {
      return;
    }
    this.opsService.findUserByEmail(this.lookupResult.email).subscribe((result) => this.lookupResult = result);
  }

  protected onSpendWindow(days: number): void {
    if (this.loadingSpend || days === this.spendDays) {
      return;
    }
    this.spendDays = days;
    this.loadSpend();
  }

  protected loadSpend(): void {
    this.loadingSpend = true;
    this.spendError = '';
    this.opsService.spendReport(this.spendDays)
      .pipe(finalize(() => this.loadingSpend = false))
      .subscribe({
        next: (report) => {
          this.spend = report;
          this.spendByLineItem = this.sumByLineItem(report.actual);
          this.spendByDay = this.sumByDay(report.actual);
        },
        error: (error) => {
          this.spend = null;
          this.spendError = getErrorMessage(error, 'The spend report could not be loaded');
        },
      });
  }

  /** Billed minus estimated: positive means the price table undercounts, negative that it overcounts. */
  protected get spendGap(): number | null {
    const spend = this.spend;
    if (!spend?.actualFetchedAt) {
      return null;
    }
    return spend.actualUsd - spend.estimatedUsd;
  }

  /** A tenth off is more than rounding: the price table, or a feature outside both ledgers. */
  protected get spendGapWide(): boolean {
    const gap = this.spendGap;
    return gap !== null && Math.abs(gap) > (this.spend?.estimatedUsd ?? 0) * 0.1;
  }

  protected spendFeatureLabel(line: SpendEstimatedLine): string {
    return SPEND_FEATURE_LABELS[line.feature] ?? line.feature.replace(/_/g, ' ');
  }

  private sumByLineItem(lines: SpendActualLine[]): SpendLineItemTotal[] {
    const totals = new Map<string, SpendLineItemTotal>();
    for (const line of lines) {
      const key = `${line.projectId}\u0000${line.lineItem}`;
      const total = totals.get(key) ?? {projectId: line.projectId, lineItem: line.lineItem, usd: 0};
      total.usd += line.usd;
      totals.set(key, total);
    }
    return [...totals.values()].sort((a, b) => b.usd - a.usd);
  }

  private sumByDay(lines: SpendActualLine[]): {day: string; usd: number}[] {
    const totals = new Map<string, number>();
    for (const line of lines) {
      totals.set(line.day, (totals.get(line.day) ?? 0) + line.usd);
    }
    return [...totals.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([day, usd]) => ({day, usd}));
  }

  private notify(message: string, appearance: 'positive' | 'negative'): void {
    this.alertService.open(message, {appearance}).subscribe();
  }
}
