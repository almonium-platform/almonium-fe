import {ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {finalize} from 'rxjs';
import {getErrorMessage} from '../../../shared/http-error';
import {ENTRY_REPORT_REASONS, EntryReport, EntryReportReason, EntryReportService} from './entry-report.service';

/** The reasons as the reader reads them; the order is the order they are offered in. */
export function reasonLabel(reason: EntryReportReason): string {
  switch (reason) {
    case 'WRONG_SENSE': return $localize`Doesn’t fit this sentence`;
    case 'WRONG_DEFINITION': return $localize`Wrong definition`;
    case 'WRONG_GRAMMAR': return $localize`Wrong form or grammar`;
    case 'WRONG_SOUND': return $localize`Wrong sound`;
    case 'BAD_EXAMPLE': return $localize`Bad example`;
  }
}

/**
 * The panel a flag opens: five reasons, an optional comment, send. The sentence only makes "doesn’t fit" possible,
 * so that reason is left out without one. After sending it says thanks and closes on the reader's word.
 */
@Component({
  selector: 'app-entry-report',
  imports: [FormsModule],
  templateUrl: './entry-report.component.html',
  styleUrl: './entry-report.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntryReportComponent {
  /** Everything but the reason and the comment, which the reader picks here. */
  @Input({required: true}) target!: Omit<EntryReport, 'reason' | 'comment'>;
  /** What is being flagged, as the panel's title names it: the word, or "sense 2 of bank". */
  @Input({required: true}) subject = '';
  @Output() closed = new EventEmitter<void>();

  private readonly reportService = inject(EntryReportService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected reason: EntryReportReason | null = null;
  protected comment = '';
  protected sending = false;
  protected sent = false;
  protected error = '';

  protected readonly sendLabel = $localize`Send report`;
  protected readonly sendingLabel = $localize`Sending…`;

  protected get reasons(): readonly EntryReportReason[] {
    return this.target.context ? ENTRY_REPORT_REASONS : ENTRY_REPORT_REASONS.filter(reason => reason !== 'WRONG_SENSE');
  }

  protected label(reason: EntryReportReason): string {
    return reasonLabel(reason);
  }

  protected send(): void {
    if (!this.reason || this.sending) return;
    this.sending = true;
    this.error = '';
    this.reportService.report({...this.target, reason: this.reason, comment: this.comment.trim() || null})
      .pipe(finalize(() => {
        this.sending = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: () => this.sent = true,
        error: error => this.error = getErrorMessage(error, $localize`The report could not be sent`),
      });
  }
}
