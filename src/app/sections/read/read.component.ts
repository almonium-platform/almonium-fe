import {logger} from "../../shared/logger";
import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import {ReadService} from "./read.service";
import {Book} from "./book.model";
import {Router, RouterLink} from "@angular/router";
import {TargetLanguageDropdownService} from "../../services/target-language-dropdown.service";
import {FormControl, ReactiveFormsModule} from "@angular/forms";
import {TuiDataListDropdownManager, TuiSkeleton} from "@taiga-ui/kit/directives";
import {BehaviorSubject, debounceTime, forkJoin, of, Subject, take} from "rxjs";
import {catchError, distinctUntilChanged, filter, finalize, switchMap, takeUntil, tap} from "rxjs/operators";
import {CEFRLevel} from "../../models/userinfo.model";
import {UserInfoService} from "../../services/user-info.service";
import {SharedLucideIconsModule} from "../../shared/shared-lucide-icons.module";
import {TuiNotificationService, TuiOption, TuiTextfieldComponent, TuiTextfieldOptionsDirective} from "@taiga-ui/core/components";
import {TuiDropdownContext, TuiDropdownDirective} from "@taiga-ui/core/portals";
import {AsyncPipe, NgStyle} from "@angular/common";
import {BookCoverComponent} from './book-cover/book-cover.component';
import {BookImport, BookImportQuota, BookImportStatus} from './book-import.model';
import {PaywallComponent} from '../../shared/paywall/paywall.component';
import {PopupTemplateStateService} from '../../shared/modals/popup-template/popup-template-state.service';
import {LocalStorageService} from '../../services/local-storage.service';

type ShelfViewMode = 'covers' | 'spines';

@Component({
  selector: 'app-read',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    SharedLucideIconsModule,
    TuiDataListDropdownManager,
    AsyncPipe,
    NgStyle,
    TuiSkeleton,
    TuiTextfieldComponent,
    TuiTextfieldOptionsDirective,
    TuiDropdownContext,
    TuiDropdownDirective,
    TuiOption,
    BookCoverComponent,
    PaywallComponent,
  ],
  templateUrl: './read.component.html',
  styleUrl: './read.component.less'
})
export class ReadComponent implements OnInit, OnDestroy {
  private readService = inject(ReadService);
  private targetLanguageDropdownService = inject(TargetLanguageDropdownService);
  private userInfoService = inject(UserInfoService);
  private alertService = inject(TuiNotificationService);
  private router = inject(Router);
  private popupTemplateStateService = inject(PopupTemplateStateService);
  private localStorageService = inject(LocalStorageService);

  @ViewChild(PaywallComponent) private paywallComponent?: PaywallComponent;

  private readonly destroy$ = new Subject<void>();
  filteredBooks: Book[] = [];
  protected allBooks: Book[] = [];
  protected continueReading: Book[] = [];
  protected isAuthenticated = false;
  protected isPremium = false;
  protected privateBooks: BookImport[] = [];
  protected importQuota: BookImportQuota | null = null;
  protected readonly importStatus = BookImportStatus;

  titleFormControl = new FormControl<string>('');
  sortParameters: string[] = ['Best rated first', 'Newest first', 'Oldest first', 'Level: low to high', 'Level: high to low'];
  sortControl = new FormControl<string>('Best rated first');

  cefrLevels: (CEFRLevel | 'Any level')[] = ['Any level', ...Object.values(CEFRLevel)];
  cefrLevelControl = new FormControl<CEFRLevel | 'Any level'>('Any level');

  selectedBook: Book | null = null;
  parallelTranslationToggle = false;
  includeTranslationsToggle = false;
  protected libraryView: ShelfViewMode = this.localStorageService.getItem<ShelfViewMode>('read_library_view') ?? 'covers';
  protected privateView: ShelfViewMode = this.localStorageService.getItem<ShelfViewMode>('read_private_view') ?? 'spines';

  loadingSubject$ = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject$.asObservable();

  ngOnInit() {
    this.userInfoService.loadUserInfo().pipe(take(1)).subscribe(user => {
      this.isAuthenticated = user !== null;
      this.isPremium = user?.premium ?? false;
      this.refreshBooks();
      if (this.isAuthenticated) this.loadPrivateLibrary();
    });
    this.listenToBookSearch();
    this.listenToSortChanges();
    this.listenToCefrLevelChanges();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Re-run the filter/sort logic every time a toggle changes
  private applyFiltersAndSort() {
    let books = this.allBooks;

    // Apply title filter if active
    if (this.titleFormControl.value) {
      const searchTerm = this.titleFormControl.value.trim().toLowerCase();
      books = books.filter(book => book.title.toLowerCase().includes(searchTerm));
    }

    if (this.cefrLevelControl.value !== 'Any level') {
      books = books.filter(book => {
        const bookLevel = this.cefrLevelToNumber(book.cefrLevel);
        const selectedLevelNum = this.cefrLevelToNumber(this.cefrLevelControl.value ?? CEFRLevel.B1);

        return selectedLevelNum === bookLevel;
      });
    }

    if (this.parallelTranslationToggle) {
      books = books.filter(book => book.hasParallelTranslation);
    }

    books = [...books];
    this.sortBooks(books);

    // Apply the filtered books to the component
    this.filteredBooks = books;
  }

  private listenToSortChanges() {
    this.sortControl.valueChanges.pipe(
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => this.applyFiltersAndSort());
  }

  private listenToCefrLevelChanges() {
    this.cefrLevelControl.valueChanges.pipe(
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => this.applyFiltersAndSort());
  }

  private listenToBookSearch(): void {
    this.titleFormControl.valueChanges
      .pipe(
        filter(value => value !== null),
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.applyFiltersAndSort());
  }

  private fetchBooksOnLanguageChange() {
    this.filteredBooks = [];
    this.targetLanguageDropdownService.currentLanguage$
      .pipe(
        tap(() => this.loadingSubject$.next(true)), // Set loading true when language changes *before* fetching
        switchMap(language => {
          return this.readService.getBooksForLang(language, this.includeTranslationsToggle)
            .pipe(
              catchError(error => {
                logger.error("Error fetching books:", error);
                return of({
                  available: [],
                  favorites: [],
                  continueReading: [],
                });
              }),
              finalize(() => this.loadingSubject$.next(false))
            );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(view => {
        // This subscribe now only handles the *result* of the fetch operation
        this.allBooks = [...view.continueReading, ...view.available, ...view.favorites];
        this.filteredBooks = this.allBooks;
        this.continueReading = view.continueReading;
        this.applyFiltersAndSort();
        // Maybe trigger change detection if needed: this.cdr.detectChanges();
      });
  }

  private fetchPublicBooks() {
    this.loadingSubject$.next(true);
    this.readService.getBooks().pipe(
      catchError(error => {
        logger.error('Error fetching public books:', error);
        return of([] as Book[]);
      }),
      finalize(() => this.loadingSubject$.next(false)),
      takeUntil(this.destroy$),
    ).subscribe(books => {
      this.allBooks = books;
      this.continueReading = [];
      this.applyFiltersAndSort();
    });
  }

  private refreshBooks() {
    if (this.isAuthenticated) this.fetchBooksOnLanguageChange();
    else this.fetchPublicBooks();
  }

  protected startImport(): void {
    if (!this.isAuthenticated) {
      void this.router.navigate(['/auth'], {fragment: 'sign-up'});
      return;
    }
    if (!this.isPremium) {
      if (this.paywallComponent) {
        this.popupTemplateStateService.open(this.paywallComponent.content, 'paywall');
      }
      return;
    }
    void this.router.navigate(['/my-books/import']);
  }

  protected importActionLabel(): string {
    if (!this.isAuthenticated) return 'Sign up to import';
    return this.isPremium ? 'Import a book' : 'Unlock private imports';
  }

  protected quotaLabel(): string | null {
    if (!this.importQuota) return null;
    if (this.importQuota.limit < 0) return 'Unlimited imports';
    const remaining = Math.max(0, this.importQuota.limit - this.importQuota.used);
    return `${remaining} of ${this.importQuota.limit} imports left this month`;
  }

  private loadPrivateLibrary(): void {
    forkJoin({
      imports: this.readService.getBookImports().pipe(catchError(() => of([] as BookImport[]))),
      quota: this.readService.getBookImportQuota().pipe(catchError(() => of(null))),
    }).pipe(takeUntil(this.destroy$)).subscribe(({imports, quota}) => {
      this.privateBooks = imports;
      this.importQuota = quota;
    });
  }

  private sortBooks(books: Book[]) {
    const sortBy = this.sortControl.value;

    books.sort((a, b) => {
      if (sortBy === 'Newest first') return b.publicationYear - a.publicationYear;
      if (sortBy === 'Oldest first') return a.publicationYear - b.publicationYear;
      if (sortBy === 'Level: low to high') return this.cefrLevelToNumber(a.cefrLevel) - this.cefrLevelToNumber(b.cefrLevel);
      if (sortBy === 'Level: high to low') return this.cefrLevelToNumber(b.cefrLevel) - this.cefrLevelToNumber(a.cefrLevel);
      return 0;
    });
  }

  private cefrLevelToNumber(level: string): number {
    const cefrMap: Record<string, number> = {A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6};
    return cefrMap[level] || 0;
  }

  onRightClick(event: MouseEvent, book: Book): void {
    event.preventDefault(); // Prevent the default context menu from showing
    this.selectedBook = book; // Set the selected book's ID
    logger.debug('Right-clicked on book with ID:', this.selectedBook.id);
  }

  undoProgress() {
    const bookId = this.selectedBook?.id;
    if (!bookId) return;
    this.targetLanguageDropdownService.currentLanguage$.pipe(take(1)).subscribe(() => {
      this.readService.deleteProgress(bookId)
        .subscribe({
          next: () => {
            this.fetchBooksOnLanguageChange();
          },
          error: (error) => {
            logger.error('Error deleting progress:', error);
            this.alertService.open('Failed to reset book progress', {appearance: 'negative'}).subscribe();
          }
        });
    });
  }

  onIncludeTranslationsChange($event: boolean) {
    this.includeTranslationsToggle = $event;
    this.refreshBooks();
  }

  onParallelTranslationChange($event: boolean) {
    this.parallelTranslationToggle = $event;
    this.applyFiltersAndSort();
  }

  protected setShelfView(shelf: 'library' | 'private', view: ShelfViewMode): void {
    if (shelf === 'library') {
      this.libraryView = view;
      this.localStorageService.saveItem('read_library_view', view);
    } else {
      this.privateView = view;
      this.localStorageService.saveItem('read_private_view', view);
    }
  }

  protected get continueBooks(): Book[] {
    return this.continueReading.slice(0, 3);
  }

  protected get shelfBooks(): Book[] {
    const continuing = new Set(this.continueBooks.map(book => book.id));
    return this.filteredBooks.filter(book => !continuing.has(book.id));
  }

  protected clearFilters(): void {
    this.titleFormControl.setValue('');
    this.cefrLevelControl.setValue('Any level');
    this.parallelTranslationToggle = false;
    if (this.includeTranslationsToggle) {
      this.includeTranslationsToggle = false;
      this.refreshBooks();
    } else {
      this.applyFiltersAndSort();
    }
  }

  protected spineStyle(id: string, wordCount: number): Record<string, string> {
    let hash = 0;
    for (const char of id) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    const hues = [332, 286, 258, 221, 194, 28, 12];
    const hue = hues[Math.abs(hash) % hues.length];
    const width = 34 + Math.abs(hash >> 3) % 33;
    const height = 142 + Math.min(32, Math.max(0, Math.round(wordCount / 3500)));
    return {'--spine-hue': `${hue}`, '--spine-width': `${width}px`, '--spine-height': `${height}px`};
  }

  protected showSpineAuthor(id: string): boolean {
    let hash = 0;
    for (const char of id) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    return 34 + Math.abs(hash >> 3) % 33 >= 44;
  }
}
