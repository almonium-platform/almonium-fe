import {CommonModule} from '@angular/common';
import {Component, OnDestroy, OnInit, ViewChild, inject} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {EMPTY, Subject, interval, startWith, switchMap, takeUntil} from 'rxjs';
import {LanguageCode} from '../../../models/language.enum';
import {Language} from '../../../models/language.model';
import {SupportedLanguagesService} from '../../../services/supported-langs.service';
import {getErrorMessage} from '../../../shared/http-error';
import {
  BookImport,
  BookImportMetadataField,
  BookImportMetadataStatus,
  BookImportQuota,
  BookImportStatus,
} from '../book-import.model';
import {ReadService} from '../read.service';
import {PaywallComponent} from '../../../shared/paywall/paywall.component';
import {PopupTemplateStateService} from '../../../shared/modals/popup-template/popup-template-state.service';

@Component({
  selector: 'app-book-import',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PaywallComponent],
  templateUrl: './book-import.component.html',
  styleUrl: './book-import.component.less',
})
export class BookImportComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly readService = inject(ReadService);
  private readonly supportedLanguagesService = inject(SupportedLanguagesService);
  private readonly popupTemplateStateService = inject(PopupTemplateStateService);
  private readonly destroy$ = new Subject<void>();

  protected languages: Language[] = [];
  protected readonly status = BookImportStatus;
  protected readonly metadataStatus = BookImportMetadataStatus;
  protected bookImport: BookImport | null = null;
  protected selectedFile: File | null = null;
  protected submitting = false;
  protected error = '';
  protected quota: BookImportQuota | null = null;
  protected quotaLoading = true;

  /** The confirmation card: shown once the processor has proposed details, editable until confirmed. */
  protected editingDetails = false;
  protected savingDetails = false;
  protected detailsError = '';
  protected detailsSavedFor: string | null = null;

  @ViewChild(PaywallComponent) private paywallComponent?: PaywallComponent;

  /** Upload asks for the file only; the language is optional and otherwise read from the file. */
  protected readonly form = new FormGroup({
    language: new FormControl<LanguageCode | ''>('', {nonNullable: true}),
  });

  protected readonly detailsForm = new FormGroup({
    title: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.maxLength(500)]}),
    author: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.maxLength(300)]}),
    description: new FormControl('', {nonNullable: true}),
    language: new FormControl<LanguageCode | ''>('', {nonNullable: true, validators: [Validators.required]}),
    publicationYear: new FormControl<number | null>(null, [Validators.min(1), Validators.max(9999)]),
  });

  ngOnInit(): void {
    this.supportedLanguagesService.supportedLanguages$.pipe(takeUntil(this.destroy$)).subscribe(languages => {
      if (languages) this.languages = languages;
    });
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.pollImport(id);
      } else {
        this.loadQuota();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected selectFile(event: Event): void {
    this.selectedFile = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  protected submit(): void {
    if (!this.selectedFile || this.submitting || !this.canImport) {
      return;
    }
    this.submitting = true;
    this.error = '';
    const body = new FormData();
    body.append('file', this.selectedFile);
    const language = this.form.getRawValue().language;
    if (language) body.append('language', language);

    this.readService.createBookImport(body).subscribe({
      next: bookImport => void this.router.navigate(['/my-books', bookImport.id]),
      error: error => {
        this.submitting = false;
        this.error = getErrorMessage(error, 'Could not import this book.');
      },
    });
  }

  protected get canImport(): boolean {
    return this.quota !== null && (this.quota.limit < 0 || this.quota.limit > this.quota.used);
  }

  /** The allowance card states the rule; this restates it where the greyed button is, so the button is not a dead end. */
  protected get importBlockedNote(): string {
    if (!this.quota) return 'Your import allowance could not be read. Reload the page to try again.';
    if (this.quota.limit === 0) return 'Importing books is a Premium feature.';
    return 'No imports left this month.';
  }

  protected get quotaMessage(): string {
    if (!this.quota) return 'Checking your import allowance…';
    if (this.quota.limit < 0) return 'Unlimited imports';
    const remaining = Math.max(0, this.quota.limit - this.quota.used);
    return `${remaining} of ${this.quota.limit} imports left this month`;
  }

  protected openPaywall(): void {
    if (this.paywallComponent) {
      this.popupTemplateStateService.open(this.paywallComponent.content, 'paywall');
    }
  }

  /** Where a detail came from, so a reader knows which values deserve a second look. */
  protected provenanceOf(field: BookImportMetadataField): string {
    switch (this.bookImport?.metadataProvenance[field]) {
      case 'ai': return 'Suggested by AI';
      case 'source': return 'From the file';
      case 'user': return 'Yours';
      default: return '';
    }
  }

  protected languageName(code: LanguageCode | null): string {
    if (!code) return 'Not detected yet';
    return this.languages.find(language => language.code === code)?.name ?? code;
  }

  protected startEditingDetails(): void {
    if (!this.bookImport) return;
    this.detailsForm.reset({
      title: this.bookImport.title,
      author: this.bookImport.author,
      description: this.bookImport.description,
      language: this.bookImport.language ?? '',
      publicationYear: this.bookImport.publicationYear,
    });
    this.detailsError = '';
    this.editingDetails = true;
  }

  protected cancelEditingDetails(): void {
    this.editingDetails = false;
    this.detailsError = '';
  }

  protected saveDetails(): void {
    const value = this.detailsForm.getRawValue();
    if (!this.bookImport || this.savingDetails || this.detailsForm.invalid || !value.language) {
      this.detailsForm.markAllAsTouched();
      return;
    }
    this.savingDetails = true;
    this.detailsError = '';
    this.readService.updateBookImportMetadata(this.bookImport.id, {
      title: value.title.trim(),
      author: value.author.trim(),
      description: value.description.trim(),
      language: value.language,
      publicationYear: value.publicationYear,
    }).subscribe({
      next: bookImport => {
        this.bookImport = bookImport;
        this.savingDetails = false;
        this.editingDetails = false;
        this.detailsSavedFor = bookImport.id;
      },
      error: error => {
        this.savingDetails = false;
        this.detailsError = getErrorMessage(error, 'Could not save these details.');
      },
    });
  }

  private loadQuota(): void {
    this.quotaLoading = true;
    this.readService.getBookImportQuota().pipe(takeUntil(this.destroy$)).subscribe({
      next: quota => {
        this.quota = quota;
        this.quotaLoading = false;
        if (quota.limit === 0) this.openPaywall();
      },
      error: error => {
        this.quotaLoading = false;
        this.error = getErrorMessage(error, 'Could not load your import allowance.');
      },
    });
  }

  private pollImport(id: string): void {
    interval(3000).pipe(
      startWith(0),
      switchMap(() => this.bookImport && this.pollingFinished(this.bookImport) ? EMPTY : this.readService.getBookImport(id)),
      takeUntil(this.destroy$),
    ).subscribe({
      next: bookImport => this.applyPolledImport(bookImport),
      error: error => this.error = getErrorMessage(error, 'Could not load import status.'),
    });
  }

  private pollingFinished(bookImport: BookImport): boolean {
    return [BookImportStatus.READY, BookImportStatus.FAILED].includes(bookImport.status);
  }

  /** The details card opens by itself when a proposal arrives, or when a ready book never got one. */
  private applyPolledImport(bookImport: BookImport): void {
    const previous = this.bookImport;
    const firstProposal = previous?.metadataStatus !== BookImportMetadataStatus.PROPOSED
      && bookImport.metadataStatus === BookImportMetadataStatus.PROPOSED;
    const readyWithoutDetails = bookImport.status === BookImportStatus.READY
      && bookImport.metadataStatus === BookImportMetadataStatus.PENDING;
    // Never overwrite a form the reader is in the middle of editing: keep the
    // details they started from and take only the processing state.
    if (this.editingDetails && previous && !firstProposal) {
      this.bookImport = {
        ...bookImport,
        title: previous.title,
        author: previous.author,
        description: previous.description,
        language: previous.language,
        publicationYear: previous.publicationYear,
      };
      return;
    }
    this.bookImport = bookImport;
    if (firstProposal || (readyWithoutDetails && !this.editingDetails)) this.startEditingDetails();
  }
}
