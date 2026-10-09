import {Component, EventEmitter, Input, LOCALE_ID, Output, inject} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {finalize} from 'rxjs/operators';
import {getErrorMessage, httpStatus} from '../../../shared/http-error';
import {
  REPORT_MESSAGE_MAX,
  REPORT_NAME_MAX,
  ReporterRole,
  RightsReportRequest,
  countryOptions,
  reportMissing,
} from './rights-report.model';
import {RightsReportService} from './rights-report.service';

/** Where reports go when the server does not say. */
const COPYRIGHT_ADDRESS = 'copyright@almonium.com';

/**
 * "Report a problem with this book's rights": who is writing, about which country, and what is wrong. A report
 * hides nothing by itself; it reaches the copyright address at once and a person decides.
 */
@Component({
  selector: 'app-rights-report',
  imports: [ReactiveFormsModule],
  templateUrl: './rights-report.component.html',
  styleUrl: './rights-report.component.less',
})
export class RightsReportComponent {
  private reportService = inject(RightsReportService);
  private locale = inject(LOCALE_ID);

  @Input({required: true}) editionSlug = '';
  @Input() bookTitle = '';
  /** A guest must leave an email; a member's account address is used. */
  @Input() guest = true;
  @Output() readonly closed = new EventEmitter<void>();

  protected readonly roles: {value: ReporterRole; label: string}[] = [
    {value: 'RIGHTS_HOLDER', label: $localize`I hold or represent the rights`},
    {value: 'READER', label: $localize`I’m a reader`},
    {value: 'OTHER', label: $localize`Other`},
  ];
  protected readonly countries = countryOptions(this.locale);
  protected readonly nameMax = REPORT_NAME_MAX;
  protected readonly messageMax = REPORT_MESSAGE_MAX;

  protected role = new FormControl<ReporterRole | null>(null);
  protected name = new FormControl('', {nonNullable: true});
  protected email = new FormControl('', {nonNullable: true});
  protected country = new FormControl('', {nonNullable: true});
  protected message = new FormControl('', {nonNullable: true});

  protected sending = false;
  protected error: string | null = null;
  /** Set once the report is in: the form gives way to the thanks. */
  protected contact: string | null = null;

  /** The line under a greyed Send: what the reader still has to do. */
  protected get missing(): string | null {
    return reportMissing({role: this.role.value, email: this.email.value, message: this.message.value, guest: this.guest});
  }

  protected get thanks(): string {
    return $localize`Thanks — we’ll look at this within a day. You can also write to ${this.contact ?? COPYRIGHT_ADDRESS}:address:.`;
  }

  protected send(): void {
    const role = this.role.value;
    if (this.sending || this.missing !== null || role === null) return;
    const name = this.name.value.trim();
    const report: RightsReportRequest = {
      role,
      country: this.country.value,
      message: this.message.value.trim(),
      ...(name ? {name} : {}),
      ...(this.guest ? {email: this.email.value.trim()} : {}),
    };
    this.sending = true;
    this.error = null;
    this.reportService.report(this.editionSlug, report).pipe(finalize(() => this.sending = false)).subscribe({
      next: receipt => this.contact = receipt.contact || COPYRIGHT_ADDRESS,
      error: error => this.error = httpStatus(error) === 429
        ? $localize`Too many reports from here; try again in an hour.`
        : getErrorMessage(error, $localize`Couldn’t send the report. Try again, or write to ${COPYRIGHT_ADDRESS}:address:.`),
    });
  }
}
