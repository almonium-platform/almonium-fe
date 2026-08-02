import {logger} from "../../shared/logger";
import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import {ReadService} from "./read.service";
import {Book} from "./book.model";
import {Router, RouterLink} from "@angular/router";
import {TargetLanguageDropdownService} from "../../services/target-language-dropdown.service";
import {FormControl, FormsModule, ReactiveFormsModule} from "@angular/forms";
import {
  TuiDataListWrapperComponent,
  TuiProgressCircle,
  TuiSelect
} from "@taiga-ui/kit/components";
import {TuiChevron, TuiDataListDropdownManager, TuiSkeleton} from "@taiga-ui/kit/directives";
import {BehaviorSubject, combineLatestWith, debounceTime, forkJoin, of, Subject, take} from "rxjs";
import {catchError, distinctUntilChanged, filter, finalize, map, switchMap, takeUntil, tap} from "rxjs/operators";
import {CEFRLevel, UserInfo} from "../../models/userinfo.model";
import {CefrLevelSelectorComponent} from "../../shared/cefr-input/cefr-level-selector.component";
import {UserInfoService} from "../../services/user-info.service";
import {SharedLucideIconsModule} from "../../shared/shared-lucide-icons.module";
import {TuiCheckbox, TuiNotificationService, TuiOption, TuiTextfieldComponent, TuiTextfieldOptionsDirective} from "@taiga-ui/core/components";
import {TuiDropdownContent, TuiDropdownContext, TuiDropdownDirective, TuiHintDirective} from "@taiga-ui/core/portals";
import {InfoIconComponent} from "../../shared/info-button/info-button.component";
import {AsyncPipe} from "@angular/common";
import {ParallelTranslationComponent} from "./parallel-translation/parallel-translation.component";
import {BookCoverComponent} from './book-cover/book-cover.component';
import {BookImport, BookImportQuota, BookImportStatus} from './book-import.model';
import {PaywallComponent} from '../../shared/paywall/paywall.component';
import {PopupTemplateStateService} from '../../shared/modals/popup-template/popup-template-state.service';

@Component({
  selector: 'app-read',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    TuiProgressCircle,
    TuiDataListWrapperComponent,
    CefrLevelSelectorComponent,
    SharedLucideIconsModule,
    TuiDataListDropdownManager,
    TuiHintDirective,
    FormsModule,
    TuiCheckbox,
    InfoIconComponent,
    AsyncPipe,
    TuiSkeleton,
    ParallelTranslationComponent,
    TuiTextfieldComponent,
    TuiTextfieldOptionsDirective,
    TuiChevron,
    TuiDropdownContent,
    TuiSelect,
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

  @ViewChild(PaywallComponent) private paywallComponent?: PaywallComponent;

  private readonly destroy$ = new Subject<void>();
  sortOrder: 'asc' | 'desc' = 'desc';

  filteredBooks: Book[] = [];
  protected allBooks: Book[] = [];
  protected continueReading: Book[] = [];
  protected isAuthenticated = false;
  protected isPremium = false;
  protected privateBooks: BookImport[] = [];
  protected importQuota: BookImportQuota | null = null;
  protected readonly importStatus = BookImportStatus;

  titleFormControl = new FormControl<string>('');
  sortParameters: string[] = ['Level', 'Year'];
  sortControl = new FormControl<string>('Level');

  cefrLevels: CEFRLevel[] = Object.values(CEFRLevel);
  cefrLevelControl = new FormControl<CEFRLevel>(CEFRLevel.A1);

  selectedBook: Book | null = null;
  filterByCefrToggle = false;
  parallelTranslationToggle = false;
  sortToggle = false;
  includeTranslationsToggle = false;

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
    this.syncCefrLevel();
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

    // Apply CEFR filter if active
    if (this.filterByCefrToggle) {
      books = books.filter(book => {
        const bookLevel = this.cefrLevelToNumber(book.cefrLevel);
        const selectedLevelNum = this.cefrLevelToNumber(this.cefrLevelControl.value ?? CEFRLevel.B1);  // Handling null values

        return selectedLevelNum === bookLevel;
      });
    }

    if (this.parallelTranslationToggle) {
      books = books.filter(book => book.hasParallelTranslation);
    }

    // Apply sorting
    if (this.sortToggle) {
      this.sortBooks(books);
    }

    // Apply the filtered books to the component
    this.filteredBooks = books;
  }

  private listenToSortChanges() {
    this.sortControl.valueChanges.pipe(
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => this.applyFiltersAndSort());
  }

  sortIconName(): string {
    return this.sortOrder === 'asc' ? 'arrow-up' : 'arrow-down';
  }

  toggleSortOrder() {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    this.applyFiltersAndSort();
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
    const factor = this.sortOrder === 'asc' ? 1 : -1;

    books.sort((a, b) => {
      if (sortBy === 'Year') {
        return factor * (a.publicationYear - b.publicationYear);
      }
      if (sortBy === 'Level') {
        return factor * (this.cefrLevelToNumber(a.cefrLevel) - this.cefrLevelToNumber(b.cefrLevel));
      }
      return 0;
    });
  }

  private cefrLevelToNumber(level: string): number {
    const cefrMap: Record<string, number> = {A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6};
    return cefrMap[level] || 0;
  }

  // Synchronize CEFR level from user data
  private syncCefrLevel() {
    this.userInfoService.userInfo$
      .pipe(
        filter((info): info is UserInfo => !!info),
        combineLatestWith(this.targetLanguageDropdownService.currentLanguage$),
        takeUntil(this.destroy$),
        map(([userInfo, targetLang]): CEFRLevel => {
          if (!userInfo.learners) return CEFRLevel.B1;
          const learner = userInfo.learners.find(learner => learner.language === targetLang);
          return learner?.selfReportedLevel ?? CEFRLevel.B1;
        })
      )
      .subscribe((level: CEFRLevel) => {
        this.cefrLevelControl.setValue(level); // Sync CEFR Level Control
        this.applyFiltersAndSort(); // Trigger filter immediately
        logger.debug('Set default sorting by CEFR Level:', level);
      });
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

  onSortChange($event: boolean) {
    this.sortToggle = $event;
    this.applyFiltersAndSort();
  }

  onFilterByCefrChange($event: boolean) {
    this.filterByCefrToggle = $event;
    this.applyFiltersAndSort();
  }

  onIncludeTranslationsChange($event: boolean) {
    this.includeTranslationsToggle = $event;
    this.refreshBooks();
  }

  onParallelTranslationChange($event: boolean) {
    this.parallelTranslationToggle = $event;
    this.applyFiltersAndSort();
  }
}
