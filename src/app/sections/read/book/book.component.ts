import {getErrorMessage} from '../../../shared/http-error';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, signal, inject } from "@angular/core";
import {filter, finalize, of, Subject, takeUntil} from "rxjs";
import {ActivatedRoute, Router} from "@angular/router";
import {TuiInput, TuiNotificationService, TuiTextfieldComponent} from "@taiga-ui/core/components";
import {TuiHintDirective} from "@taiga-ui/core/portals";
import {ReadService} from "../read.service";
import {Book} from "../book.model";
import {ButtonComponent} from "../../../shared/button/button.component";
import {StarRatingComponent} from "../star-rating.component";
import {TuiChip, TuiDataListWrapperComponent, TuiSelect} from "@taiga-ui/kit/components";
import {TuiChevron, TuiSkeleton} from "@taiga-ui/kit/directives";
import {TuiAutoColorPipe} from "@taiga-ui/kit/pipes";
import {LanguageNameService} from "../../../services/language-name.service";
import {SharedLucideIconsModule} from "../../../shared/shared-lucide-icons.module";
import {NgStyle} from "@angular/common";
import {SupportedLanguagesService} from "../../../services/supported-langs.service";
import {Language} from "../../../models/language.model";
import {FormControl, ReactiveFormsModule} from "@angular/forms";
import {catchError, distinctUntilChanged, map, switchMap} from "rxjs/operators";
import {NgClickOutsideDirective} from "ng-click-outside2";
import {ParallelTranslationComponent} from "../parallel-translation/parallel-translation.component";

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
    ReactiveFormsModule,
    NgClickOutsideDirective,
    TuiSkeleton,
    ParallelTranslationComponent,
    TuiTextfieldComponent,
    TuiChevron,
    TuiSelect,
    TuiInput,
  ],
  templateUrl: './book.component.html',
  styleUrl: './book.component.less'
})
export class BookComponent implements OnInit, OnDestroy {
  private activatedRoute = inject(ActivatedRoute);
  private alertService = inject(TuiNotificationService);
  private languageNameService = inject(LanguageNameService);
  private readService = inject(ReadService);
  private supportedLanguagesService = inject(SupportedLanguagesService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  private readonly destroy$ = new Subject<void>();
  protected bookId: number | null = null;
  protected book: Book | null = null;
  protected availableTranslations: string[] = [];
  protected bookLanguage = "";
  protected originalLanguage: string | undefined = undefined;
  private supportedLanguages: Language[] = [];
  protected showLangDropdown = false;
  protected languageSelectControl = new FormControl("Language");
  protected bookLoading = true;

  ngOnInit() {
    this.supportedLanguagesService.supportedLanguages$.subscribe((languages) => {
      if (languages) {
        this.supportedLanguages = languages;
      }
    });
    this.languageSelectControl.setValue("Language");
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
          return this.readService.getBookById(id, 'EN').pipe( // Assuming 'EN' is context language, adjust if needed
            catchError(error => {
              console.error(`Failed to fetch book data for ID ${id}:`, error);
              this.alertService.open('Failed to load book details.', {appearance: 'negative'}).subscribe();
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
        this.bookLoading = false;
        if (book) {
          this.book = book;
          this.bookLanguage = this.languageNameService.getLanguageName(book.language);
          // Reset original language info before setting new value
          this.originalLanguage = book.originalLanguage
            ? this.languageNameService.getLanguageName(book.originalLanguage)
            : undefined; // Explicitly set to undefined if no original language
          this.availableTranslations = this.languageNameService.getLanguageNames(book.languageVariants.map(t => t.language))
            .filter(lang => lang !== this.bookLanguage && lang !== this.originalLanguage);
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
    if (!this.book?.orderLanguage) {
      return '';
    }
    return this.languageNameService.getLanguageName(this.book?.orderLanguage);
  }

  get pages() {
    if (this.book?.wordCount) {
      const pages = Math.ceil(this.book.wordCount / 250);
      return pages > 0 ? pages : 1;
    }
    return 0;
  }

  get languagesAvailableForOrder(): string[] {
    return this.supportedLanguages
      .filter(lang => !this.book?.languageVariants.map(t => t.language).includes(lang.code))
      .map(lang => lang.name);
  }

  onTranslatedLanguageClick(language: string) {
    const lang = this.languageNameService.getLanguageCode(language)
    const bookIdInThisLanguage = this.book?.languageVariants.find(t => t.language === lang)?.id;
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

  protected orderLoading = false;

  orderTranslation() {
    const language = this.languageNameService.getLanguageCode(this.languageSelectControl.value!);
    if (!this.bookId || !language) {
      return;
    }
    this.showLangDropdown = false;
    this.orderLoading = true;
    const id = this.book?.originalId ?? this.bookId;
    this.readService.orderTranslation(id, language)
      .pipe(finalize(() => {
        this.orderLoading = false;
        this.languageSelectControl.setValue("Language");
      }))
      .subscribe({
        next: () => {
          this.book!.orderLanguage = language;
          this.alertService.open('Translation ordered', {appearance: 'positive'}).subscribe();
        },
        error: (error) => {
          console.error('Failed to order translation:', error);
          this.alertService.open(getErrorMessage(error, 'Couldn\'t order translation'), {appearance: 'negative'}).subscribe();
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
            this.alertService.open(message, {appearance: 'positive'}).subscribe();
            this.book!.favorite = true;
            this.cdr.detectChanges();
          }, error: (error) => {
            console.error('Failed to add to favorites:', error);
            this.alertService.open(getErrorMessage(error, 'Couldn\'t add to favorites'), {appearance: 'negative'}).subscribe();
          }
        });
    } else {
      message = 'Removed from favorites'
      this.readService.unfavoriteBook(this.bookId, this.book?.language)
        .pipe(finalize(() => this.favoriteBlocked = false))
        .subscribe({
          next: () => {
            this.alertService.open(message, {appearance: 'positive'}).subscribe();
            this.book!.favorite = false;
            this.cdr.detectChanges();
          }, error: (error) => {
            console.error('Failed to add to favorites:', error);
            this.alertService.open(getErrorMessage(error, 'Couldn\'t remove favorites'), {appearance: 'negative'}).subscribe();
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
    const id = this.book?.originalId ?? this.bookId;
    this.readService.cancelTranslationOrder(id, language)
      .pipe(finalize(() => {
        this.orderLoading = false;
      }))
      .subscribe({
        next: () => {
          this.book!.orderLanguage = undefined;
          this.alertService.open('Translation order cancelled', {appearance: 'positive'}).subscribe();
        }, error: (error) => {
          console.error('Failed to cancel translation order:', error);
          this.alertService.open(getErrorMessage(error, 'Couldn\'t cancel translation order'), {appearance: 'negative'}).subscribe();
        }
      });
  }

  getBookmarkColor(): string {
    return this.book?.favorite ? 'orange' : 'grey';
  }

  onOriginalLanguageClick() {
    if (!this.book?.originalId) {
      console.warn("Original book ID is missing, cannot navigate.");
      return;
    }

    this.navigateToId(this.book.originalId);
  }

  private navigateToId(id: number) {
    void this.router.navigate([`/book/${id}`]).then(success => {
      if (!success) {
        console.error("Navigation failed!");
      }
    });
  }

  goToReader() {
    void this.router.navigate([`/reader/${this.bookId}`]).then();
  }

  protected readonly signal = signal;

  onClickOutsideLanguageDropdown() {
    this.showLangDropdown = false;
  }

  get orderLanguageName(): string | undefined {
    // Don't try to calculate if loading, book is null, or no order language code exists
    if (this.bookLoading || !this.book?.orderLanguage) {
      return undefined; // Return undefined (or null) so the @if correctly evaluates to false
    }
    // We have a book and an orderLanguage code, get the display name
    return this.languageNameService.getLanguageName(this.book.orderLanguage);
    // Note: Ensure your languageNameService.getLanguageName handles cases
    // where the code might not be found (e.g., returns the code itself or undefined)
  }
}
