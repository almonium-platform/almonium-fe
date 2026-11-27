import {ChangeDetectionStrategy, Component, OnInit, inject} from '@angular/core';
import {DatePipe, DecimalPipe} from '@angular/common';
import {RouterLink} from '@angular/router';
import {finalize} from 'rxjs/operators';
import {getErrorMessage} from '../../shared/http-error';
import {reasonLabel} from '../../sections/discover/report/entry-report.component';
import {EntryReportGroup, OpsEntryReportsService} from '../ops-entry-reports.service';

/** A group's identity, for tracking rows and knowing which one is busy. */
export function groupId(group: Pick<EntryReportGroup, 'language' | 'headword' | 'senseKey' | 'reason'>): string {
  return [group.language, group.headword, group.senseKey ?? 'word', group.reason].join('|');
}

/**
 * /ops → Reports: what readers flagged in the dictionary, grouped by sense and reason, the most common word first.
 * Resolve closes a group once the entry is fixed, or when the reports were wrong; nothing here edits an entry.
 */
@Component({
  selector: 'app-ops-entry-reports',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './ops-entry-reports.component.html',
  styleUrl: './ops-entry-reports.component.less',
})
export class OpsEntryReportsComponent implements OnInit {
  private reportsService = inject(OpsEntryReportsService);

  protected groups: EntryReportGroup[] | null = null;
  protected loading = false;
  protected error = '';
  /** The group whose reports are open under its row. */
  protected open: string | null = null;
  protected resolving: string | null = null;
  protected readonly id = groupId;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading = true;
    this.error = '';
    this.reportsService.queue()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: groups => this.groups = groups,
        error: error => {
          this.groups = null;
          this.error = getErrorMessage(error, 'The reports could not be loaded');
        },
      });
  }

  protected toggle(group: EntryReportGroup): void {
    const id = groupId(group);
    this.open = this.open === id ? null : id;
  }

  protected resolve(group: EntryReportGroup): void {
    const id = groupId(group);
    if (this.resolving) return;
    this.resolving = id;
    this.error = '';
    this.reportsService.resolve(group)
      .pipe(finalize(() => this.resolving = null))
      .subscribe({
        next: () => this.groups = (this.groups ?? []).filter(other => groupId(other) !== id),
        error: error => this.error = getErrorMessage(error, 'The reports could not be resolved'),
      });
  }

  protected reason(group: EntryReportGroup): string {
    return reasonLabel(group.reason);
  }

  protected name(code: string): string {
    try {
      return new Intl.DisplayNames(['en'], {type: 'language'}).of(code.toLowerCase()) ?? code;
    } catch {
      return code;
    }
  }
}
