import {ChangeDetectorRef, Component, OnDestroy, OnInit} from "@angular/core";
import {filter, finalize, of, Subject, takeUntil} from "rxjs";
import {ActivatedRoute, Router} from "@angular/router";
import {TuiAlertService, TuiAutoColorPipe, TuiHintDirective} from "@taiga-ui/core";
import {ReadService} from "../read.service";
import {Book} from "../book.model";
import {ButtonComponent} from "../../../shared/button/button.component";
import {StarRatingComponent} from "../star-rating.component";
import {TuiChip, TuiDataListWrapperComponent, TuiSkeleton} from "@taiga-ui/kit";
import {LanguageNameService} from "../../../services/language-name.service";
import {SharedLucideIconsModule} from "../../../shared/shared-lucide-icons.module";
import {NgStyle} from "@angular/common";
import {SupportedLanguagesService} from "../../../services/supported-langs.service";
import {Language} from "../../../models/language.model";
import {TuiSelectModule, TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {FormControl, ReactiveFormsModule} from "@angular/forms";
import {catchError, distinctUntilChanged, map, switchMap} from "rxjs/operators";
import {NgClickOutsideDirective} from "ng-click-outside2";

@Component({
  selector: 'app-book',
  imports: [
    ButtonComponent,
    StarRatingComponent,
    TuiAutoColorPipe,
    TuiChip,
    TuiHintDirective,
    SharedLucideIconsModule,
    NgStyle,
    TuiDataListWrapperComponent,
    TuiSelectModule,
    TuiTextfieldControllerModule,
    ReactiveFormsModule,
    NgClickOutsideDirective,
    TuiSkeleton,

  ],
  templateUrl: './book.component.html',
  styleUrl: './book.component.less'
})
export class BookComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  protected bookId: number | null = null;
  protected book: Book | null = null;
  protected availableLanguages: string[] = [];
  protected bookLanguage: string = "";
  protected originalLanguage: string | undefined = undefined;
  private supportedLanguages: Language[] = [];
  protected showLangDropdown: boolean = false;
  protected languageSelectControl = new FormControl("Select Language");

  constructor(private activatedRoute: ActivatedRoute,
              private alertService: TuiAlertService,
              private languageNameService: LanguageNameService,
              private readService: ReadService,
              private supportedLanguagesService: SupportedLanguagesService,
              private router: Router,
              private cdr: ChangeDetectorRef,
  ) {
  }

  ngOnInit() {
    this.supportedLanguagesService.supportedLanguages$.subscribe((languages) => {
      if (languages) {
        this.supportedLanguages = languages;
      }
    });
    this.languageSelectControl.setValue("Select Language");
    this.languageSelectControl.valueChanges.pipe(
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => this.orderTranslation());

    // Extract the 'id' parameter from the route (Path variable)
    this.activatedRoute.paramMap
      .pipe(
        map(params => params.get('id')),
        filter((id): id is string => id !== null),
        map(id => +id),                          // Convert id string to number
        distinctUntilChanged(),                  // Only proceed if the ID truly changed
        switchMap(id => {                        // Switch to the data fetching observable
          console.log(`Route changed or initial load. Fetching book ID: ${id}`);
          this.bookId = id; // Update the component's bookId property
          // Optional: Add loading state indication here
          return this.readService.getBooksById(id, 'EN').pipe( // Assuming 'EN' is context language, adjust if needed
            catchError(error => {
              console.error(`Failed to fetch book data for ID ${id}:`, error);
              this.alertService.open('Failed to load book details.', {appearance: 'error'}).subscribe();
              this.book = null; // Clear book data on error
              this.cdr.detectChanges(); // Update view
              // Optional: Hide loading state indication here
              return of(null); // Return an observable of null to keep the stream alive
            })
          );
        }),
        takeUntil(this.destroy$) // Unsubscribe when component is destroyed
      )
      .subscribe(book => {
        // Optional: Hide loading state indication here
        if (book) {
          this.book = book;
          this.bookLanguage = this.languageNameService.getLanguageName(book.language);
          // Reset original language info before setting new value
          this.originalLanguage = book.originalLanguage
            ? this.languageNameService.getLanguageName(book.originalLanguage)
            : undefined; // Explicitly set to undefined if no original language
          this.availableLanguages = this.languageNameService.getLanguageNames(book.availableLanguages.map(t => t.language))
            .filter(lang => lang !== this.bookLanguage);
          console.log(`Successfully loaded book: ${book.title}`);
          this.cdr.detectChanges(); // Manually trigger change detection if needed (e.g., with OnPush strategy)
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get actionBtnLabel() {
    return this.book?.progressPercentage ? "Continue Reading" : "Start Reading";
  }

  get orderLanguage() {
    if (!this.book || !this.book.orderLanguage) {
      return '';
    }
    return this.languageNameService.getLanguageName(this.book?.orderLanguage);
  }

  get pages() {
    if (this.book && this.book.wordCount) {
      const pages = Math.ceil(this.book.wordCount / 250);
      return pages > 0 ? pages : 1;
    }
    return 0;
  }

  get languagesAvailableForOrder(): string[] {
    return this.supportedLanguages
      .filter(lang => !this.book?.availableLanguages.map(t => t.language).includes(lang.code))
      .map(lang => lang.name);
  }

  onTranslatedLanguageClick(language: string) {
    const lang = this.languageNameService.getLanguageCode(language)
    const bookIdInThisLanguage = this.book?.availableLanguages.find(t => t.language === lang)?.id;
    if (!bookIdInThisLanguage) {
      console.error("Book ID in this language not found");
      return;
    }
    this.navigateToId(bookIdInThisLanguage)
  }

  openLanguageDropdown() {
    const bookId = this.bookId;
    if (!bookId) {
      console.error("Book was not found");
      return;
    }

    if (this.book?.orderLanguage) {
      console.info("Order is already placed");
      return;
    }

    this.showLangDropdown = true;
  }

  protected orderLoading: boolean = false;

  orderTranslation() {
    const language = this.languageNameService.getLanguageCode(this.languageSelectControl.value!);
    if (!this.bookId || !language) {
      return;
    }
    this.showLangDropdown = false;
    this.orderLoading = true;
    const id = this.book?.originalId ? this.book?.originalId : this.bookId;
    this.readService.orderTranslation(id, language)
      .pipe(finalize(() => {
        this.orderLoading = false;
        this.languageSelectControl.setValue("Select Language");
      }))
      .subscribe({
        next: () => {
          this.book!.orderLanguage = language;
          this.alertService.open('Translation ordered successfully', {appearance: 'success'}).subscribe();
        },
        error: (error) => {
          console.error('Failed to order translation:', error);
          this.alertService.open(error.error.message || 'Couldn\'t order translation', {appearance: 'error'}).subscribe();
        }
      });
  }

  private favoriteBlocked = false;

  onBookmarkClick() {
    if (!this.book || this.favoriteBlocked || !this.bookId) {
      return;
    }

    let message: string;
    this.favoriteBlocked = true;
    if (!this.book?.favorite) {
      message = 'Added to favorites';
      this.readService.favoriteBook(this.bookId, this.book?.language)
        .pipe(finalize(() => this.favoriteBlocked = false))
        .subscribe({
          next: () => {
            this.alertService.open(message, {appearance: 'success'}).subscribe();
            this.book!.favorite = true;
            this.cdr.detectChanges();
          }, error: (error) => {
            console.error('Failed to add to favorites:', error);
            this.alertService.open(error.error.message || 'Couldn\'t add to favorites', {appearance: 'error'}).subscribe();
          }
        });
    } else {
      message = 'Removed from favorites'
      this.readService.unfavoriteBook(this.bookId, this.book?.language)
        .pipe(finalize(() => this.favoriteBlocked = false))
        .subscribe({
          next: () => {
            this.alertService.open(message, {appearance: 'success'}).subscribe();
            this.book!.favorite = false;
            this.cdr.detectChanges();
          }, error: (error) => {
            console.error('Failed to add to favorites:', error);
            this.alertService.open(error.error.message || 'Couldn\'t remove favorites', {appearance: 'error'}).subscribe();
          }
        });
    }
  }

  get bookmarkIcon() {
    if (this.book?.favorite) {
      return 'bookmark-check';
    }
    return 'bookmark';
  }

  cancelOrder() {
    const language = this.book?.orderLanguage;
    if (!this.book || !language || !this.bookId) {
      return;
    }
    this.orderLoading = true;
    this.readService.cancelTranslationOrder(this.bookId, language)
      .pipe(finalize(() => {
        this.orderLoading = false;
      }))
      .subscribe({
        next: () => {
          this.book!.orderLanguage = undefined;
          this.alertService.open('Translation order cancelled successfully', {appearance: 'success'}).subscribe();
        }, error: (error) => {
          console.error('Failed to cancel translation order:', error);
          this.alertService.open(error.error.message || 'Couldn\'t cancel translation order', {appearance: 'error'}).subscribe();
        }
      });
  }

  getBookmarkColor(): string {
    return this.book && this.book.favorite ? 'orange' : 'grey';
  }

  onOriginalLanguageClick() {
    if (!this.book || !this.book.originalId) {
      console.warn("Original book ID is missing, cannot navigate.");
      return;
    }

    this.navigateToId(this.book.originalId);
  }

  private navigateToId(id: number) {
    this.router.navigate([`/book/${id}`]).then(success => {
      if (!success) {
        console.error("Navigation failed!");
      }
    });
  }
}
