import {CommonModule} from '@angular/common';
import {Component, OnDestroy, OnInit, ViewChild, inject} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {EMPTY, Subject, interval, startWith, switchMap, takeUntil} from 'rxjs';
import {LanguageCode} from '../../../models/language.enum';
import {Language} from '../../../models/language.model';
import {SupportedLanguagesService} from '../../../services/supported-langs.service';
import {getErrorMessage} from '../../../shared/http-error';
import {BookImport, BookImportQuota, BookImportStatus} from '../book-import.model';
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
  protected bookImport: BookImport | null = null;
  protected selectedFile: File | null = null;
  protected submitting = false;
  protected error = '';
  protected quota: BookImportQuota | null = null;
  protected quotaLoading = true;

  @ViewChild(PaywallComponent) private paywallComponent?: PaywallComponent;

  protected readonly form = new FormGroup({
    title: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.maxLength(500)]}),
    author: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.maxLength(300)]}),
    description: new FormControl('', {nonNullable: true}),
    language: new FormControl(LanguageCode.EN, {nonNullable: true, validators: [Validators.required]}),
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
    if (this.form.invalid || !this.selectedFile || this.submitting || !this.canImport) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    this.error = '';
    const value = this.form.getRawValue();
    const body = new FormData();
    body.append('file', this.selectedFile);
    body.append('title', value.title);
    body.append('author', value.author);
    body.append('description', value.description);
    body.append('language', value.language);
    if (value.publicationYear !== null) body.append('publicationYear', String(value.publicationYear));

    this.readService.createBookImport(body).subscribe({
      next: bookImport => void this.router.navigate(['/my-books', bookImport.id]),
      error: error => {
        this.submitting = false;
        this.error = getErrorMessage(error, 'Could not import this book.');
      },
    });
  }

  protected get canImport(): boolean {
    return this.quota !== null && this.quota.limit > this.quota.used;
  }

  protected get quotaMessage(): string {
    if (!this.quota) return 'Checking your import allowance…';
    const remaining = Math.max(0, this.quota.limit - this.quota.used);
    return `${remaining} of ${this.quota.limit} imports left this month`;
  }

  protected openPaywall(): void {
    if (this.paywallComponent) {
      this.popupTemplateStateService.open(this.paywallComponent.content, 'paywall');
    }
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
      switchMap(() => this.bookImport && [BookImportStatus.READY, BookImportStatus.FAILED].includes(this.bookImport.status)
        ? EMPTY
        : this.readService.getBookImport(id)),
      takeUntil(this.destroy$),
    ).subscribe({
      next: bookImport => this.bookImport = bookImport,
      error: error => this.error = getErrorMessage(error, 'Could not load import status.'),
    });
  }
}
