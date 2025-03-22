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
  private userInfo: UserInfo | null = null;
  private currentCefrLevel: CEFRLevel = CEFRLevel.B1;
  sortOrder: 'asc' | 'desc' = 'desc';

  filteredBooks: Book[] = [];
  protected allBooks: Book[] = [];

  titleFormControl = new FormControl<string>('');
  sortParameters: string[] = ['Year', 'Rating', 'Level'];
  sortControl = new FormControl<string>('Year');

  // add to Object.values value Any
  cefrLevels: (CEFRLevel | 'All')[] = [...Object.values(CEFRLevel), 'All'];
  cefrLevelControl = new FormControl<(CEFRLevel | 'All')>(CEFRLevel.A1);

  selectedBook: Book | null = null;
  filterByCefrToggle: boolean = false;
  sortToggle: boolean = false;
  includeTranslationsToggle: boolean = false;

  constructor(
    private readService: ReadService,
    private targetLanguageDropdownService: TargetLanguageDropdownService,
    private userInfoService: UserInfoService,
    private alertService: TuiAlertService,
  ) {
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit() {
    this.fetchBooks();
    this.listenToBookSearch();
    this.syncCefrLevel();
    this.listenToSortChanges();
    this.listenToCefrLevelChanges();
  }

  private listenToCefrLevelChanges() {
    this.cefrLevelControl.valueChanges
      .pipe(
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(selectedLevel => {
        if (!selectedLevel) return;
        if (selectedLevel === "All") {
          this.filteredBooks = this.allBooks;
          return;
        }
        // not triggered-  how to emit initally?
        this.filterBooksByCefrLevel(selectedLevel);
      });
  }

  private filterBooksByCefrLevel(selectedLevel: CEFRLevel) {
    if (!this.allBooks.length) return;

    this.filteredBooks = this.allBooks.filter(book => {
      const bookLevelFrom = this.cefrLevelToNumber(book.levelFrom);
      const bookLevelTo = this.cefrLevelToNumber(book.levelTo);
      const selectedLevelNum = this.cefrLevelToNumber(selectedLevel);

      return selectedLevelNum >= bookLevelFrom && selectedLevelNum <= bookLevelTo;
    });

    console.log(`Filtered books by CEFR Level ${selectedLevel}:`, this.filteredBooks);
  }

  private listenToSortChanges() {
    this.sortControl.valueChanges.pipe(
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.sortBooks();
    });
  }

  sortIconName(): string {
    return this.sortOrder === 'asc' ? 'arrow-up' : 'arrow-down';
  }

  toggleSortOrder() {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    this.sortBooks();
  }

  private sortBooks() {
    if (!this.filteredBooks.length) return;

    const sortBy = this.sortControl.value;
    const factor = this.sortOrder === 'asc' ? 1 : -1;

    this.filteredBooks.sort((a, b) => {
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
        this.currentCefrLevel = level;
        this.cefrLevelControl.setValue(level); // Sync CEFR Level Control
        this.filterBooksByCefrLevel(level); // Trigger filter immediately
        console.log('Set default sorting by CEFR Level:', level);
      });
  }

  private listenToBookSearch(): void {
    this.titleFormControl.valueChanges
      .pipe(
        filter(value => value !== null),
        debounceTime(300),
        distinctUntilChanged(),
        map((value: string) => value.trim().toLowerCase()),
        filter(value => value.length >= 2 || value.length === 0),
        takeUntil(this.destroy$)
      )
      .subscribe(searchTerm => {
        this.filteredBooks = this.allBooks.filter(book =>
          book.title.toLowerCase().includes(searchTerm)
        );
      });
  }

  private fetchBooks() {
    this.targetLanguageDropdownService.currentLanguage$.subscribe(language => {
      this.readService.getBooksForLang(language).subscribe(books => {
        this.allBooks = books;
        this.filteredBooks = books;
        console.log('Books fetched:', books);

        // Apply CEFR filter after books are loaded
        const currentLevel = this.cefrLevelControl.value;
        if (currentLevel && currentLevel !== 'All') {
          this.filterBooksByCefrLevel(currentLevel);
        }
      });
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
    if ($event) {
      this.sortBooks();
    } else {

    }
  }

  onFilterByCefrChange($event: boolean) {
    if ($event) {
      this.filterBooksByCefrLevel(this.currentCefrLevel);
    } else {

    }
  }

  onIncludeTranslationsChange($event: boolean) {
    if ($event) {

    } else {
      this.filteredBooks = this.allBooks;
    }
  }
}
