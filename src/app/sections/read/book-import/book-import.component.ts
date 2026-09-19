import {CommonModule} from '@angular/common';
import {Component, OnDestroy, OnInit, TemplateRef, ViewChild, inject} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {EMPTY, Subject, Subscription, finalize, interval, startWith, switchMap, takeUntil} from 'rxjs';
import {LanguageCode} from '../../../models/language.enum';
import {Language} from '../../../models/language.model';
import {SupportedLanguagesService} from '../../../services/supported-langs.service';
import {LanguageNameService} from '../../../services/language-name.service';
import {getErrorMessage} from '../../../shared/http-error';
import {
  BookImport,
  BookImportMetadataField,
  BookImportMetadataStatus,
  BookImportQuota,
  BookImportStatus,
  LibrarySuggestionStatus,
} from '../book-import.model';
import {ReadService} from '../read.service';
import {PaywallComponent} from '../../../shared/paywall/paywall.component';
import {PopupTemplateStateService} from '../../../shared/modals/popup-template/popup-template-state.service';
import {BookCoverComponent} from '../book-cover/book-cover.component';
import {ConfirmModalComponent} from '../../../shared/modals/confirm-modal/confirm-modal.component';

/** Books first published this many years ago or more are almost always in the public domain. */
const PUBLIC_DOMAIN_YEARS = 95;

@Component({
  selector: 'app-book-import',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PaywallComponent, BookCoverComponent, ConfirmModalComponent],
  templateUrl: './book-import.component.html',
  styleUrl: './book-import.component.less',
})
export class BookImportComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly readService = inject(ReadService);
  private readonly supportedLanguagesService = inject(SupportedLanguagesService);
  private readonly languageNameService = inject(LanguageNameService);
  private readonly popupTemplateStateService = inject(PopupTemplateStateService);
  private readonly destroy$ = new Subject<void>();
  private polling: Subscription | null = null;

  protected languages: Language[] = [];
  protected readonly status = BookImportStatus;
  protected readonly metadataStatus = BookImportMetadataStatus;
  protected readonly suggestionStatus = LibrarySuggestionStatus;
  protected bookImport: BookImport | null = null;
  protected selectedFile: File | null = null;
  protected submitting = false;
  protected error = '';
  protected quota: BookImportQuota | null = null;
  protected quotaLoading = true;

  /** The details form, opened in place by Edit details or by a fresh proposal from the processor. */
  protected editingDetails = false;
  protected savingDetails = false;
  protected detailsError = '';
  protected detailsSavedFor: string | null = null;

  protected reuploading = false;
  protected deleting = false;
  protected deleteConfirmVisible = false;
  protected suggesting = false;
  protected withdrawing = false;
  /** The copyright guard is a hint, never a block: this flips the sheet back to the default ask. */
  protected suggestAnyway = false;

  @ViewChild(PaywallComponent) private paywallComponent?: PaywallComponent;
  @ViewChild('suggestSheet', {static: true}) private suggestSheet!: TemplateRef<unknown>;

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
        this.error = getErrorMessage(error, $localize`Could not import this book.`);
      },
    });
  }

  protected get canImport(): boolean {
    return this.quota !== null && (this.quota.limit < 0 || this.quota.limit > this.quota.used);
  }

  /** The allowance card states the rule; this restates it where the greyed button is, so the button is not a dead end. */
  protected get importBlockedNote(): string {
    if (!this.quota) return $localize`Your import allowance could not be read. Reload the page to try again.`;
    if (this.quota.limit === 0) return $localize`Importing books is a Premium feature.`;
    return $localize`Your shelf is full. Delete a book to make room for this one.`;
  }

  protected get quotaMessage(): string {
    if (!this.quota) return $localize`Checking your import allowance…`;
    if (this.quota.limit < 0) return $localize`Unlimited imports`;
    if (this.quota.limit === 0) return $localize`Private import is part of Premium.`;
    const remaining = Math.max(0, this.quota.limit - this.quota.used);
    const limit = this.quota.limit;
    return limit === 1
      ? $localize`${remaining}:remaining: of 1 place on your shelf`
      : $localize`${remaining}:remaining: of ${limit}:limit: places on your shelf`;
  }

  protected readonly importFailedFallback = $localize`The processor could not import this file.`;
  protected readonly optionalLabel = $localize`Optional`;
  protected readonly reuploadLabel = $localize`Re-upload`;
  protected readonly reuploadingLabel = $localize`Uploading…`;
  protected readonly suggestLabel = $localize`Suggest it`;
  protected readonly suggestingLabel = $localize`Suggesting…`;
  protected readonly deleteConfirmText = $localize`Delete`;

  protected get fileLabel(): string {
    return this.selectedFile?.name ?? $localize`Choose an EPUB or TEI XML file`;
  }

  // --- The header (G10) ---

  /** A file the processor could not name yet keeps its filename, in mono, on an ink cover. */
  protected get unnamed(): boolean {
    return this.bookImport?.metadataStatus === BookImportMetadataStatus.PENDING;
  }

  protected get metaLine(): string {
    const book = this.bookImport;
    if (!book) return '';
    const parts = [book.author, book.language ? this.languageNameService.getLanguageName(book.language) : '', book.publicationYear ? String(book.publicationYear) : ''];
    return parts.filter(Boolean).join(' · ');
  }

  protected get wordsLabel(): string {
    const words = this.bookImport?.wordCount ?? 0;
    if (words >= 1000) return $localize`${Math.round(words / 1000)}:thousands:k words`;
    return $localize`${words}:words: words`;
  }

  // --- Owner actions ---

  protected get deleteTitle(): string {
    return $localize`Delete “${this.bookImport?.title ?? ''}:title:”?`;
  }

  protected readonly deleteMessage = $localize`Your copy and its reading position go with it. This does not give an import back for the month.`;

  protected confirmDelete(): void {
    const book = this.bookImport;
    if (!book || this.deleting) return;
    this.deleting = true;
    this.deleteConfirmVisible = false;
    this.readService.deleteBookImport(book.id)
      .pipe(finalize(() => this.deleting = false))
      .subscribe({
        next: () => void this.router.navigate(['/read']),
        error: error => this.error = getErrorMessage(error, $localize`Could not delete this book.`),
      });
  }

  protected reupload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const book = this.bookImport;
    if (!file || !book || this.reuploading) return;
    this.reuploading = true;
    this.error = '';
    const body = new FormData();
    body.append('file', file);
    this.readService.replaceBookImportFile(book.id, body)
      .pipe(finalize(() => this.reuploading = false))
      .subscribe({
        next: updated => {
          this.bookImport = updated;
          this.pollImport(updated.id);
        },
        error: error => this.error = getErrorMessage(error, $localize`Could not replace the file.`),
      });
  }

  // --- The suggestion (G11, G12) ---

  /** The library takes a finished, named book: ready, with its title, author and language confirmed. */
  protected get canSuggest(): boolean {
    const book = this.bookImport;
    return book?.status === BookImportStatus.READY
      && book.metadataStatus === BookImportMetadataStatus.CONFIRMED
      && !!book.title.trim() && !!book.author.trim() && !!book.language;
  }

  protected get suggestBlockedNote(): string {
    const book = this.bookImport;
    if (book?.status !== BookImportStatus.READY) return $localize`Available once the book is ready.`;
    return $localize`Confirm the title, author and language first.`;
  }

  protected get probablyCopyrighted(): boolean {
    const year = this.bookImport?.publicationYear;
    return !year || year > new Date().getFullYear() - PUBLIC_DOMAIN_YEARS;
  }

  protected get suggestionDetails(): string {
    return this.metaLine;
  }

  protected get copyrightCopy(): string {
    const book = this.bookImport;
    if (!book) return '';
    if (!book.publicationYear) {
      return $localize`We don't know when “${book.title}:title:” was first published. Without a year the library can't tell whether it may carry it. You can keep reading your copy.`;
    }
    return $localize`“${book.title}:title:” was published in ${book.publicationYear}:year:. Books this recent are almost never in the public domain, and the library can't carry them. You can keep reading your copy.`;
  }

  protected openSuggestSheet(): void {
    if (!this.canSuggest) return;
    this.suggestAnyway = false;
    this.popupTemplateStateService.open(this.suggestSheet, 'library-suggestion');
  }

  protected closeSheet(): void {
    this.popupTemplateStateService.close();
  }

  protected editFromSheet(): void {
    this.closeSheet();
    this.startEditingDetails();
  }

  protected confirmSuggestion(): void {
    const book = this.bookImport;
    if (!book || this.suggesting) return;
    this.suggesting = true;
    this.readService.suggestForLibrary(book.id)
      .pipe(finalize(() => this.suggesting = false))
      .subscribe({
        next: suggestion => {
          this.bookImport = {...book, librarySuggestion: suggestion};
          this.closeSheet();
        },
        error: error => this.error = getErrorMessage(error, $localize`Could not send the suggestion.`),
      });
  }

  protected withdrawSuggestion(): void {
    const book = this.bookImport;
    if (!book || this.withdrawing) return;
    this.withdrawing = true;
    this.readService.withdrawLibrarySuggestion(book.id)
      .pipe(finalize(() => this.withdrawing = false))
      .subscribe({
        next: () => this.bookImport = {...book, librarySuggestion: null},
        error: error => this.error = getErrorMessage(error, $localize`Could not withdraw the suggestion.`),
      });
  }

  protected get libraryCopyNote(): string {
    const languages = this.bookImport?.librarySuggestion?.libraryParallelLanguages ?? [];
    if (languages.length === 0) return $localize`The library copy can be read there, and you can ask for a parallel text.`;
    const names = languages.map(code => this.languageNameService.getLanguageName(code)).join(', ');
    return $localize`The library copy can be read alongside ${names}:languages:, and you can ask for more.`;
  }

  // --- Details ---

  protected get detailsJustSaved(): boolean {
    return this.bookImport !== null && this.detailsSavedFor === this.bookImport.id;
  }

  protected openPaywall(): void {
    if (this.paywallComponent) {
      this.popupTemplateStateService.open(this.paywallComponent.content, 'paywall');
    }
  }

  /** Where a detail came from, so a reader knows which values deserve a second look. */
  protected provenanceOf(field: BookImportMetadataField): string {
    switch (this.bookImport?.metadataProvenance[field]) {
      case 'ai': return $localize`Suggested by AI`;
      case 'source': return $localize`From the file`;
      case 'user': return $localize`Yours`;
      default: return '';
    }
  }

  protected languageName(code: LanguageCode | null): string {
    if (!code) return $localize`Not detected yet`;
    return this.languages.find(language => language.code === code)?.name ?? code;
  }

  protected startEditingDetails(): void {
    if (!this.bookImport) return;
    this.detailsForm.reset({
      title: this.unnamed ? '' : this.bookImport.title,
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
        this.detailsError = getErrorMessage(error, $localize`Could not save these details.`);
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
    this.polling?.unsubscribe();
    this.polling = interval(3000).pipe(
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
