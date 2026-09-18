import {ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, inject} from '@angular/core';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {Meta, Title} from '@angular/platform-browser';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {HttpErrorResponse} from '@angular/common/http';
import {AppHttpError} from '../../../shared/app-http-error';
import {getErrorMessage} from '../../../shared/http-error';
import {PublicFooterComponent} from '../../../shared/public-footer/public-footer.component';
import {LanguageNameService} from '../../../services/language-name.service';
import {ReadService} from '../read.service';
import {CertificateCardComponent} from './certificate-card.component';
import {BookCertificate, certificatePath} from './certificate.model';

/**
 * The public page (design K1): a stranger arrives from a friend's post and sees the certificate exactly as the
 * reader saw it, then one sentence and one button that opens the same book in the public reader. No pricing, no
 * feature list, no second call to action. A page the reader has turned off is the standard missing-page state.
 */
@Component({
  selector: 'app-certificate-page',
  imports: [RouterLink, CertificateCardComponent, PublicFooterComponent],
  templateUrl: './certificate-page.component.html',
  styleUrl: './certificate-page.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificatePageComponent implements OnInit, OnDestroy {
  protected certificate: BookCertificate | null = null;
  protected loading = true;
  protected loadError = '';

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly readService = inject(ReadService);
  private readonly languageNames = inject(LanguageNameService);
  private readonly pageTitle = inject(Title);
  private readonly meta = inject(Meta);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.load(params.get('username') ?? '', params.get('editionSlug') ?? '');
    });
  }

  ngOnDestroy(): void {
    for (const name of ['description']) this.meta.removeTag(`name='${name}'`);
    for (const property of ['og:type', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:width', 'og:image:height']) {
      this.meta.removeTag(`property='${property}'`);
    }
    this.meta.removeTag("name='twitter:card'");
  }

  private load(username: string, editionSlug: string): void {
    this.loading = true;
    this.loadError = '';
    this.certificate = null;
    this.cdr.markForCheck();
    this.readService.getPublicCertificate(username, editionSlug).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: certificate => {
        this.certificate = certificate;
        this.loading = false;
        this.describePage(certificate);
        this.cdr.markForCheck();
      },
      error: error => {
        if ((error instanceof AppHttpError || error instanceof HttpErrorResponse) && error.status === 404) {
          void this.router.navigate(['/404'], {skipLocationChange: true});
          return;
        }
        this.loadError = getErrorMessage(error, $localize`The certificate could not be loaded.`);
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  protected get languageName(): string {
    return this.certificate ? this.languageNames.getLanguageName(this.certificate.language) : '';
  }

  /** The title, the twelve words as the description, and the image the link unfurls into (K2): nothing beyond the page. */
  private describePage(certificate: BookCertificate): void {
    const title = $localize`@${certificate.username}:username: read ${certificate.title}:title: in ${this.languageName}:language: · Almonium`;
    const description = certificate.words.join(', ');
    const url = `${window.location.origin}${certificatePath(certificate)}`;
    this.pageTitle.setTitle(title);
    this.meta.updateTag({name: 'description', content: description});
    this.meta.updateTag({property: 'og:type', content: 'website'});
    this.meta.updateTag({property: 'og:title', content: title});
    this.meta.updateTag({property: 'og:description', content: description});
    this.meta.updateTag({property: 'og:url', content: url});
    this.meta.updateTag({property: 'og:image', content: `${url}/og.png`});
    this.meta.updateTag({property: 'og:image:width', content: '1200'});
    this.meta.updateTag({property: 'og:image:height', content: '630'});
    this.meta.updateTag({name: 'twitter:card', content: 'summary_large_image'});
  }
}
