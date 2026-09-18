import {ChangeDetectionStrategy, Component, Input, inject} from '@angular/core';
import {DatePipe, DecimalPipe} from '@angular/common';
import {LanguageNameService} from '../../../services/language-name.service';
import {BookCertificate} from './certificate.model';

/**
 * The certificate itself (design K, from Ideas 08): white paper, a double hairline, the mark, the title block, the
 * twelve rarest words, the counts, the wordmark. A printed object, so it keeps its own colours in both themes and is
 * the same wherever it is shown: at the end of the book, on the public page, in the shelf's sheet.
 */
@Component({
  selector: 'app-certificate-card',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './certificate-card.component.html',
  styleUrl: './certificate-card.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificateCardComponent {
  @Input({required: true}) certificate!: BookCertificate;
  /** The deeper shadow of the moment it arrives in (K3); the page and the sheet use the card rule. */
  @Input() raised = false;

  private readonly languageNames = inject(LanguageNameService);

  protected get languageName(): string {
    return this.languageNames.getLanguageName(this.certificate.language);
  }
}
