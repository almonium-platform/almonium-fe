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
import {TuiNotificationService, TuiOption} from "@taiga-ui/core/components";
import {TuiDropdownContext, TuiDropdownDirective, TuiHintDirective} from "@taiga-ui/core/portals";
import {AsyncPipe, DatePipe, NgStyle} from "@angular/common";
import {BookCoverComponent} from './book-cover/book-cover.component';
import {BookImport, BookImportMetadataStatus, BookImportQuota, BookImportStatus} from './book-import.model';
import {PaywallComponent} from '../../shared/paywall/paywall.component';
import {PopupTemplateStateService} from '../../shared/modals/popup-template/popup-template-state.service';
import {LocalStorageService} from '../../services/local-storage.service';
import {TranslationOrder, TranslationOrderStatus, TranslationRequestQuota} from './translation-order.model';
import {LanguageNameService} from '../../services/language-name.service';
import {LanguageCode} from '../../models/language.enum';
import {BookHue, bookColor, dominantBookHue, hashedBookHue, hashedSpineWidth} from './book-hue';
import {getErrorMessage} from '../../shared/http-error';

type ShelfViewMode = 'covers' | 'spines';

@Component({
  selector: 'app-read',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    SharedLucideIconsModule,
    TuiDataListDropdownManager,
    AsyncPipe,
    DatePipe,
    NgStyle,
    TuiSkeleton,
    TuiDropdownContext,
    TuiDropdownDirective,
    TuiHintDirective,
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
  private languageNameService = inject(LanguageNameService);

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
  protected readonly orderStatus = TranslationOrderStatus;
  protected orders: TranslationOrder[] = [];
  protected requestQuota: TranslationRequestQuota | null = null;
  protected withdrawing: string | null = null;
  protected currentLanguageName = '';
  /** Hues sampled from cover art, by book id; anything missing falls back to the hash. */
  private sampledHues = new Map<string, BookHue>();

  titleFormControl = new FormControl<string>('');
  sortParameters: string[] = ['Best rated first', 'Newest first', 'Oldest first', 'Shortest first', 'Longest first', 'Level: low to high', 'Level: high to low'];
  sortControl = new FormControl<string>('Best rated first');

  cefrLevels: (CEFRLevel | 'Any level')[] = ['Any level', ...Object.values(CEFRLevel)];
  cefrLevelControl = new FormControl<CEFRLevel | 'Any level'>('Any level');
  /** The sort keys stay English in the control; only the option text is translated. */
  protected readonly sortLabels: Record<string, string> = {
    'Best rated first': $localize`Best rated first`,
    'Newest first': $localize`Newest first`,
    'Oldest first': $localize`Oldest first`,
    'Shortest first': $localize`Shortest first`,
    'Longest first': $localize`Longest first`,
    'Level: low to high': $localize`Level: low to high`,
    'Level: high to low': $localize`Level: high to low`,
  };

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
      if (this.isAuthenticated) {
        this.loadPrivateLibrary();
        this.loadRequests();
      }
    });
    this.targetLanguageDropdownService.currentLanguage$.pipe(takeUntil(this.destroy$)).subscribe(language => {
      this.currentLanguageName = this.languageNameService.getLanguageName(language);
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

    if (this.searchTerm) {
      books = books.filter(book => this.matchesSearch(book.title, book.author));
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

  private get searchTerm(): string {
    return (this.titleFormControl.value ?? '').trim().toLowerCase();
  }

  private matchesSearch(title: string, author: string | null): boolean {
    const term = this.searchTerm;
    return title.toLowerCase().includes(term) || (author ?? '').toLowerCase().includes(term);
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
        this.sampleCoverHues(this.allBooks);
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
      this.sampleCoverHues(books);
    });
  }

  /** Snap each cover's dominant colour to the palette so a spine matches the art it stands for. */
  private sampleCoverHues(books: Book[]): void {
    for (const book of books) {
      if (!book.coverUrl || this.sampledHues.has(book.id)) continue;
      void dominantBookHue(book.coverUrl).then(hue => {
        if (hue !== null) this.sampledHues.set(book.id, hue);
      });
    }
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
    if (!this.isAuthenticated) return $localize`Sign up to import`;
    return this.isPremium ? $localize`Import a book` : $localize`Unlock private imports`;
  }

  protected quotaLabel(): string | null {
    if (!this.importQuota) return null;
    if (this.importQuota.limit < 0) return $localize`Unlimited imports`;
    const remaining = Math.max(0, this.importQuota.limit - this.importQuota.used);
    const limit = this.importQuota.limit;
    return limit === 1
      ? $localize`${remaining}:remaining: of 1 import left this month`
      : $localize`${remaining}:remaining: of ${limit}:limit: imports left this month`;
  }

  /** The line under the fulfilment notice: how much of the monthly allowance is still free. */
  protected requestsLeftLabel(): string | null {
    const quota = this.requestQuota;
    if (!quota || quota.limit < 0) return null;
    const remaining = Math.max(0, quota.limit - quota.used);
    return remaining === 1
      ? $localize`1 request left this month.`
      : $localize`${remaining}:remaining: requests left this month.`;
  }

  protected levelLabel(level: CEFRLevel | 'Any level'): string {
    return level === 'Any level' ? $localize`Any level` : level;
  }

  protected languageName(code: LanguageCode): string {
    return this.languageNameService.getLanguageName(code);
  }

  protected pagesLabel(wordCount: number): string {
    const pages = Math.max(1, Math.ceil(wordCount / 250));
    return $localize`${pages}:pages: pp`;
  }

  protected bookAriaLabel(book: {title: string; author: string | null}): string {
    return book.author ? $localize`${book.title}:title: by ${book.author}:author:` : book.title;
  }

  /** The empty library says which filters emptied it, so the reader knows what to undo. */
  protected get emptyLibraryMessage(): string {
    const level = this.cefrLevelControl.value;
    const parts: string[] = [];
    if (level && level !== 'Any level') parts.push($localize`at ${level}:level:`);
    if (this.parallelTranslationToggle) parts.push($localize`with parallel text`);
    if (this.isAuthenticated && !this.includeTranslationsToggle) parts.push($localize`with translations off`);
    if (this.searchTerm) parts.push($localize`matching “${this.titleFormControl.value?.trim()}:search:”`);
    if (parts.length === 0) return $localize`Nothing on the shelf yet.`;
    return $localize`Nothing ${parts.join(' ')}:filters:.`;
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

  private loadRequests(): void {
    forkJoin({
      orders: this.readService.getTranslationOrders().pipe(catchError(() => of([] as TranslationOrder[]))),
      quota: this.readService.getTranslationRequestQuota().pipe(catchError(() => of(null))),
    }).pipe(takeUntil(this.destroy$)).subscribe(({orders, quota}) => {
      this.orders = orders;
      this.requestQuota = quota;
    });
  }

  /** Fulfilled requests the reader has not opened yet: the notice at the top of the page. */
  protected get unseenReadyOrders(): TranslationOrder[] {
    return this.orders.filter(order => order.status === TranslationOrderStatus.READY && !order.seenAt);
  }

  protected openFulfilled(order: TranslationOrder): void {
    if (!order.seenAt) {
      this.readService.markTranslationOrderSeen(order.id).subscribe({
        next: () => this.orders = this.orders.map(o => o.id === order.id ? {...o, seenAt: new Date().toISOString()} : o),
        error: error => logger.warn('Could not mark the request as seen', error),
      });
    }
    void this.router.navigate(['/books', order.bookEditionSlug]);
  }

  protected withdraw(order: TranslationOrder): void {
    if (this.withdrawing) return;
    this.withdrawing = order.id;
    this.readService.cancelTranslationOrder(order.bookId, order.language)
      .pipe(finalize(() => this.withdrawing = null))
      .subscribe({
        next: () => {
          this.orders = this.orders.filter(o => o.id !== order.id);
          if (this.requestQuota) this.requestQuota = {...this.requestQuota, used: Math.max(0, this.requestQuota.used - 1)};
        },
        error: error => this.alertService.open(getErrorMessage(error, $localize`Couldn't withdraw the request`), {appearance: 'negative'}).subscribe(),
      });
  }

  private sortBooks(books: Book[]) {
    const sortBy = this.sortControl.value;

    books.sort((a, b) => {
      if (sortBy === 'Newest first') return b.publicationYear - a.publicationYear;
      if (sortBy === 'Oldest first') return a.publicationYear - b.publicationYear;
      if (sortBy === 'Shortest first') return a.wordCount - b.wordCount;
      if (sortBy === 'Longest first') return b.wordCount - a.wordCount;
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
            this.alertService.open($localize`Failed to reset book progress`, {appearance: 'negative'}).subscribe();
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

  /** Search and sort act on the private shelf too; level does not, because imports are not levelled. */
  protected get privateShelfBooks(): BookImport[] {
    const books = this.searchTerm
      ? this.privateBooks.filter(book => this.matchesSearch(book.title, book.author))
      : [...this.privateBooks];
    const sortBy = this.sortControl.value;
    if (sortBy === 'Newest first') books.sort((a, b) => (b.publicationYear ?? 0) - (a.publicationYear ?? 0));
    if (sortBy === 'Oldest first') books.sort((a, b) => (a.publicationYear ?? 0) - (b.publicationYear ?? 0));
    if (sortBy === 'Shortest first') books.sort((a, b) => a.wordCount - b.wordCount);
    if (sortBy === 'Longest first') books.sort((a, b) => b.wordCount - a.wordCount);
    return books;
  }

  /** A file the processor could not name yet: it wears the filename in mono on an ink spine. */
  protected isUnnamed(book: BookImport): boolean {
    return book.metadataStatus === BookImportMetadataStatus.PENDING;
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

  protected bookColor(id: string, coverUrl: string | null = null): string {
    return bookColor(this.hueFor(id, coverUrl));
  }

  private hueFor(id: string, coverUrl: string | null): BookHue {
    return (coverUrl ? this.sampledHues.get(id) : undefined) ?? hashedBookHue(id);
  }

  /**
   * A spine's colour comes from the palette, its thickness from the id, and its height from the
   * page count within a 142–174px band: two dimensions of variation is what makes a shelf scannable.
   */
  protected spineStyle(id: string, wordCount: number, coverUrl: string | null = null): Record<string, string> {
    const height = 142 + Math.min(32, Math.max(0, Math.round(wordCount / 3500)));
    return {
      '--book-color': bookColor(this.hueFor(id, coverUrl)),
      '--spine-width': `${hashedSpineWidth(id)}px`,
      '--spine-height': `${height}px`,
    };
  }

  /** Author drops off below 44px: a spine is a handle, not a citation. */
  protected showSpineAuthor(id: string): boolean {
    return hashedSpineWidth(id) >= 44;
  }
}
