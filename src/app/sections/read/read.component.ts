import {Component, OnDestroy, OnInit} from '@angular/core';
import {ReadService} from "./read.service";
import {Book} from "./book.model";
import {RouterLink} from "@angular/router";
import {TargetLanguageDropdownService} from "../../services/target-language-dropdown.service";
import {TuiInputModule, TuiSelectModule, TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {FormControl, FormsModule, ReactiveFormsModule} from "@angular/forms";
import {
  TuiCheckbox,
  TuiDataListDropdownManager,
  TuiDataListWrapperComponent,
  TuiProgressCircle,
  TuiProgressLabel
} from "@taiga-ui/kit";
import {combineLatestWith, debounceTime, Subject} from "rxjs";
import {distinctUntilChanged, filter, map, takeUntil} from "rxjs/operators";
import {CEFRLevel, UserInfo} from "../../models/userinfo.model";
import {CefrLevelSelectorComponent} from "../../shared/cefr-input/cefr-level-selector.component";
import {UserInfoService} from "../../services/user-info.service";
import {SharedLucideIconsModule} from "../../shared/shared-lucide-icons.module";
import {TuiAlertService, TuiHintDirective} from "@taiga-ui/core";
import {InfoIconComponent} from "../../shared/info-button/info-button.component";

@Component({
  selector: 'app-read',
  imports: [
    RouterLink,
    TuiInputModule,
    TuiTextfieldControllerModule,
    ReactiveFormsModule,
    TuiProgressLabel,
    TuiProgressCircle,
    TuiDataListWrapperComponent,
    TuiSelectModule,
    CefrLevelSelectorComponent,
    SharedLucideIconsModule,
    TuiDataListDropdownManager,
    TuiHintDirective,
    FormsModule,
    TuiCheckbox,
    InfoIconComponent,
  ],
  templateUrl: './read.component.html',
  styleUrl: './read.component.less'
})
export class ReadComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  sortOrder: 'asc' | 'desc' = 'desc';

  filteredBooks: Book[] = [];
  protected allBooks: Book[] = [];
  protected continueReading: Book[] = [];

  titleFormControl = new FormControl<string>('');
  sortParameters: string[] = ['Year', 'Rating', 'Level'];
  sortControl = new FormControl<string>('Year');

  cefrLevels: (CEFRLevel | 'All')[] = [...Object.values(CEFRLevel), 'All'];
  cefrLevelControl = new FormControl<(CEFRLevel | 'All')>(CEFRLevel.A1);

  selectedBook: Book | null = null;
  filterByCefrToggle: boolean = false;
  parallelTranslationToggle: boolean = false;
  sortToggle: boolean = false;
  includeTranslationsToggle: boolean = false;

  constructor(
    private readService: ReadService,
    private targetLanguageDropdownService: TargetLanguageDropdownService,
    private userInfoService: UserInfoService,
    private alertService: TuiAlertService,
  ) {
  }

  ngOnInit() {
    this.fetchBooks();
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
    if (this.filterByCefrToggle && this.cefrLevelControl.value !== 'All') {
      books = books.filter(book => {
        const bookLevelFrom = this.cefrLevelToNumber(book.levelFrom);
        const bookLevelTo = this.cefrLevelToNumber(book.levelTo);
        const selectedLevelNum = this.cefrLevelToNumber(this.cefrLevelControl.value || CEFRLevel.B1);  // Handling null values

        return selectedLevelNum >= bookLevelFrom && selectedLevelNum <= bookLevelTo;
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

  private fetchBooks() {
    this.targetLanguageDropdownService.currentLanguage$.subscribe(language => {
      this.readService.getBooksForLang(language, this.includeTranslationsToggle).subscribe(view => {
        this.allBooks = view.recommended;
        this.filteredBooks = view.recommended;
        this.continueReading = view.continueReading;
        this.applyFiltersAndSort(); // Apply filters/sort after fetching books
      });
    });
  }

  private sortBooks(books: Book[]) {
    const sortBy = this.sortControl.value;
    const factor = this.sortOrder === 'asc' ? 1 : -1;

    books.sort((a, b) => {
      if (sortBy === 'Year') {
        return factor * (a.publicationYear - b.publicationYear);
      }
      if (sortBy === 'Rating') {
        return factor * (a.rating - b.rating);
      }
      if (sortBy === 'Level') {
        return factor * (this.cefrLevelToNumber(a.levelTo) - this.cefrLevelToNumber(b.levelTo));
      }
      return 0;
    });
  }

  private cefrLevelToNumber(level: string): number {
    const cefrMap: { [key: string]: number } = {A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6};
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
          return learner?.selfReportedLevel || CEFRLevel.B1;
        })
      )
      .subscribe((level: CEFRLevel) => {
        this.cefrLevelControl.setValue(level); // Sync CEFR Level Control
        this.applyFiltersAndSort(); // Trigger filter immediately
        console.log('Set default sorting by CEFR Level:', level);
      });
  }

  onRightClick(event: MouseEvent, book: Book): void {
    event.preventDefault(); // Prevent the default context menu from showing
    this.selectedBook = book; // Set the selected book's ID
    console.log('Right-clicked on book with ID:', this.selectedBook.id);
  }

  undoProgress() {
    const bookId = this.selectedBook?.id;
    if (!bookId) return;
    this.targetLanguageDropdownService.currentLanguage$.subscribe(lang => {
      this.readService.deleteProgress(bookId, lang)
        .subscribe({
          next: () => {
            this.fetchBooks();
          },
          error: (error) => {
            console.error('Error deleting progress:', error);
            this.alertService.open('Failed to reset book progress', {appearance: 'error'}).subscribe();
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
    this.fetchBooks();
  }

  onParallelTranslationChange($event: boolean) {
    this.parallelTranslationToggle = $event;
    this.applyFiltersAndSort();
  }
}
