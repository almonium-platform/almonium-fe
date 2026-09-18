import {ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {finalize} from 'rxjs';
import {logger} from '../../../shared/logger';
import {getErrorMessage} from '../../../shared/http-error';
import {ReadService} from '../read.service';
import {CertificateCardComponent} from './certificate-card.component';
import {BookCertificate, certificatePath} from './certificate.model';

/**
 * The moment (design K3): the last page, then the certificate, then the decision. Under the final paragraph, on
 * the reader's cream, with no confetti and no "congratulations". The reader decides on the spot whether the page
 * is public: the switch is here and only here, and again in the finished book's sheet on the shelf (K4).
 */
@Component({
  selector: 'app-certificate-moment',
  imports: [RouterLink, CertificateCardComponent],
  templateUrl: './certificate-moment.component.html',
  styleUrl: './certificate-moment.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificateMomentComponent implements OnInit {
  @Input({required: true}) bookId = '';
  /** "Chapter 10 of 10 · the end" above the certificate; absent in the shelf's sheet, which has no final paragraph. */
  @Input() endLine = '';
  /** In the sheet the second action closes it; at the end of the book it goes back to the shelf. */
  @Input() sheet = false;
  @Output() closed = new EventEmitter<void>();

  protected certificate: BookCertificate | null = null;
  protected loading = true;
  protected loadError = '';
  protected switching = false;
  protected saving = false;
  protected copied = false;

  private readonly readService = inject(ReadService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading = true;
    this.loadError = '';
    this.readService.issueCertificate(this.bookId).pipe(
      finalize(() => { this.loading = false; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: certificate => this.certificate = certificate,
      error: error => this.loadError = getErrorMessage(error, $localize`The certificate could not be prepared.`),
    });
  }

  /** The address as the reader will say it aloud: host and path, no scheme. */
  protected get publicAddress(): string {
    return this.certificate ? `${window.location.host}${certificatePath(this.certificate)}` : '';
  }

  protected get publicUrl(): string {
    return this.certificate ? `${window.location.origin}${certificatePath(this.certificate)}` : '';
  }

  protected togglePublicPage(): void {
    const certificate = this.certificate;
    if (!certificate || this.switching) return;
    this.switching = true;
    this.readService.setCertificateVisibility(this.bookId, !certificate.publicPage).pipe(
      finalize(() => { this.switching = false; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: updated => this.certificate = updated,
      error: error => logger.error('Could not change the certificate page visibility', error),
    });
  }

  protected copyLink(): void {
    if (!this.certificate?.publicPage) return;
    navigator.clipboard.writeText(this.publicUrl).then(() => {
      this.copied = true;
      this.cdr.markForCheck();
      if (this.copiedTimer) clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => { this.copied = false; this.cdr.markForCheck(); }, 1500);
    }, error => logger.error('Could not copy the certificate link', error));
  }

  /** Downloads the same 1200×630 PNG the link unfurls into (K2). */
  protected saveImage(): void {
    const certificate = this.certificate;
    if (!certificate || this.saving) return;
    this.saving = true;
    this.readService.getCertificateImage(this.bookId).pipe(
      finalize(() => { this.saving = false; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `almonium-${certificate.editionSlug}.png`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: error => logger.error('Could not download the certificate image', error),
    });
  }
}
