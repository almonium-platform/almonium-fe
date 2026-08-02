import {CommonModule} from '@angular/common';
import {Component, OnDestroy, OnInit, inject} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {EMPTY, Subject, interval, startWith, switchMap, takeUntil} from 'rxjs';
import {LanguageCode} from '../../../models/language.enum';
import {Language} from '../../../models/language.model';
import {SupportedLanguagesService} from '../../../services/supported-langs.service';
import {getErrorMessage} from '../../../shared/http-error';
import {BookImport, BookImportStatus} from '../book-import.model';
import {ReadService} from '../read.service';

@Component({
  selector: 'app-book-import',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './book-import.component.html',
  styleUrl: './book-import.component.less',
})
export class BookImportComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly readService = inject(ReadService);
  private readonly supportedLanguagesService = inject(SupportedLanguagesService);
  private readonly destroy$ = new Subject<void>();

  protected languages: Language[] = [];
  protected readonly status = BookImportStatus;
  protected bookImport: BookImport | null = null;
  protected selectedFile: File | null = null;
  protected submitting = false;
  protected error = '';

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
      if (id) this.pollImport(id);
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
    if (this.form.invalid || !this.selectedFile || this.submitting) {
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
