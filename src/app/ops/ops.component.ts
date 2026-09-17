import {Component, OnInit, inject} from '@angular/core';
import {CurrencyPipe, DatePipe, DecimalPipe, LowerCasePipe} from '@angular/common';
import {FormBuilder, FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {finalize} from 'rxjs';
import {getErrorMessage} from '../shared/http-error';
import {RecentAuthGuardService} from '../authentication/auth/recent-auth-guard.service';
import {RecentAuthGuardComponent} from '../shared/recent-auth-guard/recent-auth-guard.component';
import {
  AccessGrantRequest,
  BookRequestQueue,
  BookRequestRow,
  FirebaseAccountSummary,
  LibrarySuggestionQueue,
  LibrarySuggestionRow,
  TranslationJob,
  TranslationQueue,
  TranslationQueueRow,
  BROADCAST_CHANNELS,
  BroadcastLanguage,
  Entitlement,
  OpsService,
  OpsUserSummary,
  SpendActualLine,
  SpendEstimatedLine,
  SpendReport,
  StatsReport,
  SubscriptionCount,
} from './ops.service';

/** The ledgers name features by their internal purpose; the page names them for a reader. */
const SPEND_FEATURE_LABELS: Record<string, string> = {
  chat: 'Almo chat',
  translation: 'Book translation',
  literary_translation: 'Book translation',
  alignment_adjudication: 'Book alignment',
  import_metadata: 'Import metadata',
};

/** The backend names subscription states for the reconciliation code; the page names them for a reader. */
const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionCount['status'], string> = {
  ACTIVE: 'Active',
  ACTIVE_TILL_CYCLE_END: 'Cancelling at cycle end',
  CANCELED: 'Cancelled',
  PAUSED: 'Paused',
  INACTIVE: 'Inactive',
};

/** Charges summed over the window for one line item of one project. */
export interface SpendLineItemTotal {
  projectId: string;
  lineItem: string;
  usd: number;
}

@Component({
  selector: 'app-ops',
  imports: [ReactiveFormsModule, RecentAuthGuardComponent, DatePipe, DecimalPipe, CurrencyPipe, LowerCasePipe],
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

  protected stats: StatsReport | null = null;
  protected loadingStats = false;
  protected statsError = '';

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
    this.loadStats();
    this.loadSpend();
    this.loadTranslationQueue();
    this.loadLibrarySuggestions();
    this.loadBookRequests();

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

  protected loadStats(): void {
    this.loadingStats = true;
    this.statsError = '';
    this.opsService.stats()
      .pipe(finalize(() => this.loadingStats = false))
      .subscribe({
        next: (report) => this.stats = report,
        error: (error: unknown) => {
          this.stats = null;
          this.statsError = getErrorMessage(error, 'The stats could not be loaded');
        },
      });
  }

  /** Paying members: everyone on a plan above FREE that is active or running out its cycle. */
  protected get payingMembers(): number {
    return (this.stats?.subscriptions ?? [])
      .filter((line) => line.plan !== 'FREE' && (line.status === 'ACTIVE' || line.status === 'ACTIVE_TILL_CYCLE_END'))
      .reduce((sum, line) => sum + line.count, 0);
  }

  protected subscriptionStatusLabel(status: SubscriptionCount['status']): string {
    return SUBSCRIPTION_STATUS_LABELS[status] ?? status;
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

  /** The ID is what support tickets and DB queries speak in, so it is one tap away. */
  protected onCopyUserId(userId: string): void {
    if (!userId) {
      return;
    }
    navigator.clipboard.writeText(userId).then(
      () => this.notify('User ID copied.', 'positive'),
      () => this.notify('Could not copy the user ID.', 'negative'),
    );
  }

  private notify(message: string, appearance: 'positive' | 'negative'): void {
    this.alertService.open(message, {appearance}).subscribe();
  }

  // --- Books: the translation-request queue (G9) ---

  protected translationQueue: TranslationQueue | null = null;
  protected loadingTranslationQueue = false;
  protected translationQueueError = '';
  /** The pair being approved or declined, as "bookId/language", so one row greys at a time. */
  protected decidingPair: string | null = null;
  protected cancellingJob: string | null = null;

  protected loadTranslationQueue(): void {
    this.loadingTranslationQueue = true;
    this.translationQueueError = '';
    this.opsService.translationQueue()
      .pipe(finalize(() => this.loadingTranslationQueue = false))
      .subscribe({
        next: (queue) => this.translationQueue = queue,
        error: (error) => {
          this.translationQueue = null;
          this.translationQueueError = getErrorMessage(error, 'The translation queue could not be loaded');
        },
      });
  }

  protected pairKey(row: TranslationQueueRow): string {
    return `${row.bookId}/${row.language}`;
  }

  /** The spend bar is a hard ceiling: at the budget Approve greys and the queue keeps collecting. */
  protected get budgetExhausted(): boolean {
    return this.translationQueue?.budgetExhausted ?? false;
  }

  protected get budgetPercent(): number {
    const queue = this.translationQueue;
    if (!queue || queue.monthBudgetUsd <= 0) return 0;
    return Math.min(100, Math.round(queue.monthSpendUsd / queue.monthBudgetUsd * 100));
  }

  protected get monthLabel(): string {
    const start = this.translationQueue?.monthStartsAt;
    return new Intl.DateTimeFormat('en', {month: 'long', timeZone: 'UTC'}).format(start ? new Date(start) : new Date());
  }

  protected isLive(job: TranslationJob | null): boolean {
    return !!job && ['QUEUED', 'TRANSLATING', 'ALIGNING', 'QA_GATE', 'PUBLISHING'].includes(job.phase);
  }

  /** The four states as the processor names them, with the live one lit. */
  protected readonly translationPhases: {phase: TranslationJob['phase']; label: string}[] = [
    {phase: 'TRANSLATING', label: 'translating'},
    {phase: 'ALIGNING', label: 'aligning'},
    {phase: 'QA_GATE', label: 'qa gate'},
    {phase: 'PUBLISHING', label: 'publish + notify'},
  ];

  protected phaseIndex(phase: TranslationJob['phase']): number {
    const order: TranslationJob['phase'][] = ['QUEUED', 'TRANSLATING', 'ALIGNING', 'QA_GATE', 'PUBLISHING', 'PUBLISHED'];
    return order.indexOf(phase);
  }

  protected whoLabel(row: {premiumAsks?: number; freeAsks?: number; premiumCount?: number; freeCount?: number}): string {
    const premium = row.premiumAsks ?? row.premiumCount ?? 0;
    const free = row.freeAsks ?? row.freeCount ?? 0;
    const parts: string[] = [];
    if (premium) parts.push(`${premium} prem`);
    if (free) parts.push(`${free} free`);
    return parts.join(', ') || '—';
  }

  protected onApproveTranslation(row: TranslationQueueRow): void {
    if (this.decidingPair || this.budgetExhausted) return;
    this.recentAuthGuardService.guardAction(() => this.performApproveTranslation(row), false, 'Approve');
  }

  private performApproveTranslation(row: TranslationQueueRow): void {
    this.decidingPair = this.pairKey(row);
    this.opsService.approveTranslation(row.bookId, row.language)
      .pipe(finalize(() => this.decidingPair = null))
      .subscribe({
        next: () => {
          this.notify(`Approved ${row.bookTitle} → ${row.language}. The job is with the book processor.`, 'positive');
          this.loadTranslationQueue();
        },
        error: (error) => this.notify(getErrorMessage(error, 'Failed to approve the translation'), 'negative'),
      });
  }

  protected onDeclineTranslation(row: TranslationQueueRow): void {
    if (this.decidingPair) return;
    this.recentAuthGuardService.guardAction(() => this.performDeclineTranslation(row), false, 'Decline');
  }

  private performDeclineTranslation(row: TranslationQueueRow): void {
    this.decidingPair = this.pairKey(row);
    this.opsService.declineTranslation(row.bookId, row.language)
      .pipe(finalize(() => this.decidingPair = null))
      .subscribe({
        next: () => {
          this.notify(`Declined ${row.asks} request${row.asks === 1 ? '' : 's'} for ${row.bookTitle} → ${row.language}. Each requester gets a plain mail.`, 'positive');
          this.loadTranslationQueue();
        },
        error: (error) => this.notify(getErrorMessage(error, 'Failed to decline the requests'), 'negative'),
      });
  }

  protected onCancelTranslationJob(job: TranslationJob): void {
    if (this.cancellingJob) return;
    this.recentAuthGuardService.guardAction(() => this.performCancelTranslationJob(job), false, 'Cancel');
  }

  private performCancelTranslationJob(job: TranslationJob): void {
    this.cancellingJob = job.id;
    this.opsService.cancelTranslationJob(job.id)
      .pipe(finalize(() => this.cancellingJob = null))
      .subscribe({
        next: () => {
          this.notify('Job cancelled. The requests are back in the open queue.', 'positive');
          this.loadTranslationQueue();
        },
        error: (error) => this.notify(getErrorMessage(error, 'Failed to cancel the job'), 'negative'),
      });
  }

  // --- Books: the request queue (G20) ---

  protected bookRequestQueue: BookRequestQueue | null = null;
  protected loadingBookRequests = false;
  protected bookRequestsError = '';
  protected decidingBookRequest: string | null = null;

  protected loadBookRequests(): void {
    this.loadingBookRequests = true;
    this.bookRequestsError = '';
    this.opsService.bookRequests()
      .pipe(finalize(() => this.loadingBookRequests = false))
      .subscribe({
        next: (queue) => this.bookRequestQueue = queue,
        error: (error) => {
          this.bookRequestQueue = null;
          this.bookRequestsError = getErrorMessage(error, 'The book requests could not be loaded');
        },
      });
  }

  /** The Public domain column: the lookup result stored at ask time, never a legal verdict. */
  protected publicDomainLabel(row: BookRequestRow): string {
    switch (row.publicDomain) {
      case 'gutenberg': return `Gutenberg #${row.gutenbergId}`;
      case 'yes': return 'Yes';
      default: return 'Unlikely';
    }
  }

  /** Author, year, and the languages the work already exists in when it does. */
  protected bookRequestMeta(row: BookRequestRow): string {
    const parts = [row.author || 'Unknown author'];
    if (row.publicationYear) parts.push(String(row.publicationYear));
    if (row.haveLanguages.length) parts.push(`have ${row.haveLanguages.join(', ')}`);
    return parts.join(' · ');
  }

  /** "Add edition" or "New work": the row moves to In progress and the editorial catalogue opens prefilled. */
  protected onStartBookRequest(row: BookRequestRow): void {
    if (this.decidingBookRequest) return;
    this.recentAuthGuardService.guardAction(() => this.performBookRequestDecision(row, 'start'), false, row.workSlug ? 'Add edition' : 'New work');
  }

  protected onDeclineBookRequest(row: BookRequestRow): void {
    if (this.decidingBookRequest) return;
    this.recentAuthGuardService.guardAction(() => this.performBookRequestDecision(row, 'decline'), false, 'Decline');
  }

  private performBookRequestDecision(row: BookRequestRow, decision: 'start' | 'decline'): void {
    this.decidingBookRequest = row.id;
    const call = decision === 'start' ? this.opsService.startBookRequest(row.id) : this.opsService.declineBookRequest(row.id);
    call.pipe(finalize(() => this.decidingBookRequest = null)).subscribe({
      next: (updated) => {
        if (decision === 'start') window.open(updated.editorialUrl, '_blank', 'noopener');
        this.loadBookRequests();
      },
      error: (error) => this.notify(getErrorMessage(error, `Failed to ${decision} the request`), 'negative'),
    });
  }

  // --- Books: library suggestions (G13) ---

  protected suggestionQueue: LibrarySuggestionQueue | null = null;
  protected loadingSuggestions = false;
  protected suggestionsError = '';
  protected decidingSuggestion: string | null = null;

  protected loadLibrarySuggestions(): void {
    this.loadingSuggestions = true;
    this.suggestionsError = '';
    this.opsService.librarySuggestions()
      .pipe(finalize(() => this.loadingSuggestions = false))
      .subscribe({
        next: (queue) => this.suggestionQueue = queue,
        error: (error) => {
          this.suggestionQueue = null;
          this.suggestionsError = getErrorMessage(error, 'The library suggestions could not be loaded');
        },
      });
  }

  protected readonly ingestPhases: {phase: string; label: string}[] = [
    {phase: 'ingesting', label: 'ingesting'},
    {phase: 'review', label: 'metadata + level'},
    {phase: 'ready', label: 'cover'},
    {phase: 'published', label: 'publish + notify'},
  ];

  protected ingestPhaseIndex(phase: string | null): number {
    return ['ingesting', 'review', 'ready', 'published'].indexOf(phase ?? '');
  }

  protected suggestionFileUrl(row: LibrarySuggestionRow): string {
    return this.opsService.suggestionFileUrl(row.id);
  }

  protected onAcceptSuggestion(row: LibrarySuggestionRow): void {
    if (this.decidingSuggestion) return;
    this.recentAuthGuardService.guardAction(() => this.performSuggestionDecision(row, 'accept'), false, 'Accept');
  }

  protected onDeclineSuggestion(row: LibrarySuggestionRow): void {
    if (this.decidingSuggestion) return;
    this.recentAuthGuardService.guardAction(() => this.performSuggestionDecision(row, 'decline'), false, 'Decline');
  }

  protected onPointToLibrary(row: LibrarySuggestionRow): void {
    if (this.decidingSuggestion || !row.libraryMatch) return;
    this.recentAuthGuardService.guardAction(() => this.performSuggestionDecision(row, 'point'), false, 'Point');
  }

  protected onCancelIngest(row: LibrarySuggestionRow): void {
    if (this.decidingSuggestion) return;
    this.recentAuthGuardService.guardAction(() => this.performSuggestionDecision(row, 'cancel'), false, 'Cancel');
  }

  private performSuggestionDecision(row: LibrarySuggestionRow, decision: 'accept' | 'decline' | 'point' | 'cancel'): void {
    this.decidingSuggestion = row.id;
    const call = decision === 'accept' ? this.opsService.acceptSuggestion(row.id)
      : decision === 'decline' ? this.opsService.declineSuggestion(row.id)
      : decision === 'point' ? this.opsService.pointSuggestionToLibrary(row.id, row.libraryMatch!.bookId)
      : this.opsService.cancelSuggestionIngest(row.id);
    const done: Record<typeof decision, string> = {
      accept: `Accepted ${row.title}. One ingest job is with the book processor; level and cover are set there before it is published.`,
      decline: `Declined ${row.title}. Each suggester gets a plain mail.`,
      point: `${row.title} now points at the library copy.`,
      cancel: `Cancelled. ${row.title} is back in the open queue; purge the processor edition by hand.`,
    };
    call.pipe(finalize(() => this.decidingSuggestion = null)).subscribe({
      next: () => {
        this.notify(done[decision], 'positive');
        this.loadLibrarySuggestions();
      },
      error: (error) => this.notify(getErrorMessage(error, `Failed to ${decision} the suggestion`), 'negative'),
    });
  }
}
