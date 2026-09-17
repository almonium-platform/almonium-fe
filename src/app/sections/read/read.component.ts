import {logger} from "../../shared/logger";
import { Component, ElementRef, OnDestroy, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import {ReadService} from "./read.service";
import {Book} from "./book.model";
import {Router, RouterLink} from "@angular/router";
import {TargetLanguageDropdownService} from "../../services/target-language-dropdown.service";
import {FormControl, ReactiveFormsModule} from "@angular/forms";
import {TuiDataListDropdownManager, TuiSkeleton} from "@taiga-ui/kit/directives";
import {BehaviorSubject, debounceTime, forkJoin, of, Subject, take} from "rxjs";
import {BookLookup} from './book-request.model';
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
import {TilePreferences, WorkTile, groupIntoWorks, originalsFirst, workKey} from './work-tile';
import {ReaderPositionStorage} from './reader/reader-position-storage.service';

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
  private positionStorage = inject(ReaderPositionStorage);

  @ViewChild(PaywallComponent) private paywallComponent?: PaywallComponent;
  @ViewChild('askSheet', {static: true}) private askSheet!: TemplateRef<unknown>;

  /** The foot of the shelf (G18): the ask line shows once the reader has scrolled to it, so a full shelf never advertises what it lacks. */
  @ViewChild('shelfEnd') set shelfEnd(element: ElementRef<HTMLElement> | undefined) {
    this.shelfEndObserver?.disconnect();
    this.shelfEndObserver = null;
    if (!element || this.shelfEndReached) return;
    if (typeof IntersectionObserver === 'undefined') {
      this.shelfEndReached = true;
      return;
    }
    this.shelfEndObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        this.shelfEndReached = true;
        this.shelfEndObserver?.disconnect();
        this.shelfEndObserver = null;
      }
    });
    this.shelfEndObserver.observe(element.nativeElement);
  }

  private shelfEndObserver: IntersectionObserver | null = null;
  protected shelfEndReached = false;

  // --- Asking for a book (G19) ---
  protected askStep: 'route' | 'form' = 'route';
  protected askTitleControl = new FormControl<string>('', {nonNullable: true});
  protected askLanguage: LanguageCode | null = null;
  protected askLookup: BookLookup | null = null;
  protected askLookupPending = false;
  protected asking = false;
  private readonly askLookup$ = new Subject<void>();

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
  private currentLanguage: LanguageCode | null = null;
  /** Hues sampled from cover art, by work (or import id); anything missing falls back to the hash. */
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
  /** On by default for every language (G17): the point of the chip is to have something to read. */
  includeTranslationsToggle = true;
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
      this.currentLanguage = language;
      this.currentLanguageName = this.languageNameService.getLanguageName(language);
    });
    this.listenToBookSearch();
    this.listenToSortChanges();
    this.listenToCefrLevelChanges();
    this.listenToAskLookup();
  }

  ngOnDestroy() {
    this.shelfEndObserver?.disconnect();
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

  /**
   * Snap each cover's dominant colour to the palette so a spine matches the art it stands for. The hue is
   * kept per work, so a tile keeps its colour whichever edition it opens.
   */
  private sampleCoverHues(books: Book[]): void {
    for (const book of books) {
      if (!book.coverUrl || this.sampledHues.has(book.workSlug)) continue;
      void dominantBookHue(book.coverUrl).then(hue => {
        if (hue !== null) this.sampledHues.set(book.workSlug, hue);
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

  // --- Asking for a book (G18, G19) ---

  /** The reader's active languages, the shelf's language first: the chips of the sheet. */
  protected get askLanguages(): LanguageCode[] {
    const active = this.userInfoService.currentUserInfo?.learners.filter(learner => learner.active).map(learner => learner.language) ?? [];
    const current = this.currentLanguage;
    return current && active.includes(current) ? [current, ...active.filter(code => code !== current)] : active;
  }

  /** The quiet line's verb, and the empty search's "Ask for it": a guest is sent to sign in first. */
  protected openAskSheet(): void {
    if (!this.isAuthenticated) {
      void this.router.navigate(['/auth'], {queryParams: {returnUrl: '/read'}});
      return;
    }
    this.askStep = 'route';
    this.askLookup = null;
    this.askLanguage = this.currentLanguage ?? this.askLanguages[0] ?? null;
    this.askTitleControl.setValue(this.titleFormControl.value?.trim() ?? '', {emitEvent: false});
    this.popupTemplateStateService.open(this.askSheet, 'ask-for-a-book');
  }

  /** One question routes the ask: no text means a public-domain request, a text of their own means the import flow. */
  protected chooseHaveText(hasText: boolean): void {
    if (hasText) {
      this.closeAskSheet();
      this.startImport();
      return;
    }
    this.askStep = 'form';
    this.askLookup$.next();
  }

  protected pickAskLanguage(code: LanguageCode): void {
    this.askLanguage = code;
    this.askLookup$.next();
  }

  protected closeAskSheet(): void {
    this.popupTemplateStateService.close();
  }

  private listenToAskLookup(): void {
    this.askTitleControl.valueChanges.pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.askLookup$.next());
    this.askLookup$.pipe(
      switchMap(() => {
        const query = this.askTitleControl.value.trim();
        const language = this.askLanguage;
        if (query.length < 2 || !language) {
          this.askLookupPending = false;
          return of(null);
        }
        this.askLookupPending = true;
        return this.readService.lookupBookRequest(query, language).pipe(
          catchError(() => of(null)),
          finalize(() => this.askLookupPending = false),
        );
      }),
      takeUntil(this.destroy$),
    ).subscribe(lookup => this.askLookup = lookup);
  }

  /** The grey line under the field: the index result, and how many already asked when that is two or more. */
  protected get askResultLine(): string | null {
    const query = this.askTitleControl.value.trim();
    if (query.length < 2 || this.askLookupPending) return null;
    const lookup = this.askLookup;
    const found = lookup?.publicDomain === 'gutenberg'
      ? $localize`We found ${lookup.title}:title: on Project Gutenberg.`
      : $localize`We couldn’t confirm this is public domain. We’ll check.`;
    const askers = lookup?.askers ?? 0;
    return askers >= 2 ? `${found} ${$localize`${askers}:count: readers have asked for it.`}` : found;
  }

  /** The title the ask goes out under: the index's spelling when it matched, the reader's otherwise. */
  private get askTitle(): string {
    const lookup = this.askLookup;
    if (lookup?.publicDomain === 'gutenberg' && lookup.title) return lookup.title;
    return this.askTitleControl.value.split(',')[0].trim();
  }

  protected get askButtonLabel(): string {
    if (this.askLookup?.onShelf) return $localize`Open it`;
    const title = this.askTitle;
    return title ? $localize`Ask for ${title}:title:` : $localize`Ask for it`;
  }

  /** The line under a greyed Ask button: what the reader still has to do. */
  protected get askBlockedNote(): string | null {
    if (this.canAsk || this.askLookup?.onShelf || this.asking) return null;
    if (this.askLookupPending) return $localize`Checking the title…`;
    if (this.askTitle.length === 0) return $localize`Type the title to ask for it.`;
    if (this.askLanguage === null) return $localize`Pick the language you’d read it in.`;
    return null;
  }

  protected get canAsk(): boolean {
    return !this.asking && !this.askLookupPending && this.askTitle.length > 0 && this.askLanguage !== null;
  }

  protected submitAsk(): void {
    const onShelf = this.askLookup?.onShelf;
    if (onShelf) {
      this.closeAskSheet();
      void this.router.navigate(['/books', onShelf.editionSlug]);
      return;
    }
    const language = this.askLanguage;
    if (!this.canAsk || !language) return;
    const rest = this.askTitleControl.value.split(',').slice(1);
    const lookup = this.askLookup;
    const title = this.askTitle;
    const author = lookup?.publicDomain === 'gutenberg' && lookup.author ? lookup.author : rest.join(',').trim();
    this.asking = true;
    this.readService.askForBook({title, author, language})
      .pipe(finalize(() => this.asking = false))
      .subscribe({
        next: () => {
          this.closeAskSheet();
          this.alertService.open($localize`Asked. We’ll tell you when ${title}:title: is on the shelf.`, {appearance: 'positive'}).subscribe();
        },
        error: error => this.alertService.open(getErrorMessage(error, $localize`Couldn’t send the ask`), {appearance: 'negative'}).subscribe(),
      });
  }

  /** The empty search says what to do (G18): the term, and the one verb. */
  protected get emptySearchTerm(): string | null {
    const term = this.titleFormControl.value?.trim() ?? '';
    return term.length > 0 ? term : null;
  }

  private sortBooks(books: Book[]) {
    books.sort((a, b) => this.compareBooks(a, b));
  }

  /** The chosen order; when its keys tie, originals come before translations (G17). */
  private compareBooks(a: Book, b: Book): number {
    const sortBy = this.sortControl.value;
    let order = 0;
    if (sortBy === 'Newest first') order = b.publicationYear - a.publicationYear;
    if (sortBy === 'Oldest first') order = a.publicationYear - b.publicationYear;
    if (sortBy === 'Shortest first') order = a.wordCount - b.wordCount;
    if (sortBy === 'Longest first') order = b.wordCount - a.wordCount;
    if (sortBy === 'Level: low to high') order = this.cefrLevelToNumber(a.cefrLevel) - this.cefrLevelToNumber(b.cefrLevel);
    if (sortBy === 'Level: high to low') order = this.cefrLevelToNumber(b.cefrLevel) - this.cefrLevelToNumber(a.cefrLevel);
    return order || originalsFirst(a, b);
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

  /**
   * One tile per work (G14): the editions that passed the filters, grouped by work after the filter so a
   * level filter never hides a work with an edition at that level, then ordered by the edition each tile
   * opens. A work is open once any edition is: it lies in the Continue row and does not stand on the shelf.
   */
  protected get shelfTiles(): WorkTile[] {
    const open = new Set(this.continueBooks.map(workKey));
    const editions = this.filteredBooks.filter(book => !open.has(workKey(book)));
    return groupIntoWorks(editions, this.tilePreferences).sort((a, b) => this.compareBooks(a.edition, b.edition));
  }

  /**
   * What decides which edition a tile opens: the level filter, then the edition last opened (the server's
   * reading order first, then a place kept on this device), then the level closest at or below the
   * reader's own, then the lowest. A guest gets the original, or the lowest.
   */
  private get tilePreferences(): TilePreferences {
    const level = this.cefrLevelControl.value;
    const lastOpenedRank = new Map<string, number>();
    this.continueReading.forEach((book, index) => lastOpenedRank.set(book.editionSlug, index));
    for (const book of this.filteredBooks) {
      if (!lastOpenedRank.has(book.editionSlug) && this.positionStorage.get(`public:${book.editionSlug}`)) {
        lastOpenedRank.set(book.editionSlug, lastOpenedRank.size);
      }
    }
    const learner = this.userInfoService.currentUserInfo?.learners.find(item => item.language === this.currentLanguage);
    return {
      levelFilter: level && level !== 'Any level' ? level : null,
      lastOpenedRank,
      selfLevel: learner?.selfReportedLevel ?? null,
      guest: !this.isAuthenticated,
    };
  }

  /** The tile's caption (G17): author, level, and the one honest word when the prose is a translation. */
  protected captionFor(book: Book, pages = false): string {
    const parts = [book.author, ...(pages ? [this.pagesLabel(book.wordCount)] : []), book.cefrLevel];
    if (book.isTranslation) parts.push($localize`Translation`);
    return parts.join(' · ');
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

  /** `key` is the work for a library book and the import id for a private one: the same book, the same colour forever. */
  protected bookColor(key: string, coverUrl: string | null = null): string {
    return bookColor(this.hueFor(key, coverUrl));
  }

  private hueFor(key: string, coverUrl: string | null): BookHue {
    return (coverUrl ? this.sampledHues.get(key) : undefined) ?? hashedBookHue(key);
  }

  /**
   * A spine's colour comes from the palette, its thickness from the id, and its height from the
   * page count within a 142–174px band: two dimensions of variation is what makes a shelf scannable.
   */
  protected spineStyle(key: string, wordCount: number, coverUrl: string | null = null): Record<string, string> {
    const height = 142 + Math.min(32, Math.max(0, Math.round(wordCount / 3500)));
    return {
      '--book-color': bookColor(this.hueFor(key, coverUrl)),
      '--spine-width': `${hashedSpineWidth(key)}px`,
      '--spine-height': `${height}px`,
    };
  }

  /** Author drops off below 44px: a spine is a handle, not a citation. */
  protected showSpineAuthor(key: string): boolean {
    return hashedSpineWidth(key) >= 44;
  }
}
