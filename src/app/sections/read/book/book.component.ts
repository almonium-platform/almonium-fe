import {logger} from "../../../shared/logger";
import {getErrorMessage} from '../../../shared/http-error';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, signal, inject } from "@angular/core";
import {filter, finalize, of, Subject, takeUntil} from "rxjs";
import {ActivatedRoute, Router} from "@angular/router";
import {Meta, Title} from '@angular/platform-browser';
import {TuiInput, TuiNotificationService, TuiTextfieldComponent} from "@taiga-ui/core/components";
import {TuiHintDirective} from "@taiga-ui/core/portals";
import {ReadService} from "../read.service";
import {Book} from "../book.model";
import {LanguageCode} from "../../../models/language.enum";
import {TranslationOrder, TranslationOrderStatus} from "../translation-order.model";
import {ButtonComponent} from "../../../shared/button/button.component";
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
import {BookCoverComponent} from '../book-cover/book-cover.component';
import {UserInfoService} from '../../../services/user-info.service';

@Component({
  selector: 'app-book',
  imports: [
    ButtonComponent,
    BookCoverComponent,
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
  private userInfoService = inject(UserInfoService);
  private pageTitle = inject(Title);
  private meta = inject(Meta);

  private readonly destroy$ = new Subject<void>();
  protected bookId: string | null = null;
  protected bookSlug: string | null = null;
  protected authenticated = false;
  protected book: Book | null = null;
  protected availableTranslations: string[] = [];
  protected bookLanguage = "";
  protected originalLanguage: string | undefined = undefined;
  private supportedLanguages: Language[] = [];
  protected showLangDropdown = false;
  /** Open requests this reader has on this book, one per language. */
  protected orderedLanguages: LanguageCode[] = [];
  protected withdrawing: LanguageCode | null = null;
  protected languageSelectControl = new FormControl("Language");
  protected bookLoading = true;

  ngOnInit() {
    this.authenticated = this.userInfoService.currentUserInfo !== null;
    this.supportedLanguagesService.supportedLanguages$.pipe(takeUntil(this.destroy$)).subscribe((languages) => {
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
        map(params => params.get('slug')),
        filter((slug): slug is string => slug !== null && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)),
        distinctUntilChanged(),                  // Only proceed if the ID truly changed
        switchMap(slug => {                        // Switch to the data fetching observable
          logger.debug(`Route changed or initial load. Fetching book slug: ${slug}`);
          this.bookSlug = slug;
          // Optional: Add loading state indication here
          return this.readService.getPublicBook(slug).pipe(
            catchError(error => {
              logger.error(`Failed to fetch book data for slug ${slug}:`, error);
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
          this.bookId = book.id;
          this.pageTitle.setTitle(`${book.title} by ${book.author} | Almonium`);
          this.meta.updateTag({name: 'description', content: book.description || `Read ${book.title} by ${book.author} on Almonium.`});
          this.bookLanguage = this.languageNameService.getLanguageName(book.language);
          // Reset original language info before setting new value
          this.originalLanguage = book.originalLanguage
            ? this.languageNameService.getLanguageName(book.originalLanguage)
            : undefined; // Explicitly set to undefined if no original language
          this.availableTranslations = this.languageNameService.getLanguageNames(book.languageVariants.map(t => t.language))
            .filter(lang => lang !== this.bookLanguage && lang !== this.originalLanguage);
          logger.debug(`Successfully loaded book: ${book.title}`);
          this.loadTranslationOrders();
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

  /**
   * The book page is public, so request state comes from the reader's own orders rather
   * than the book projection. Without this the chips would vanish on every reload.
   */
  private loadTranslationOrders() {
    if (!this.authenticated) {
      this.orderedLanguages = [];
      return;
    }
    const originalId = this.originalBookId;
    this.readService.getTranslationOrders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders: TranslationOrder[]) => {
          this.orderedLanguages = orders
            .filter(order => order.bookId === originalId && order.status === TranslationOrderStatus.ASKED)
            .map(order => order.language);
          this.cdr.detectChanges();
        },
        error: (error) => logger.error('Failed to load translation requests:', error),
      });
  }

  private get originalBookId(): string | null {
    return this.book?.originalId ?? this.bookId;
  }

  get orderedLanguageNames(): {code: LanguageCode, name: string}[] {
    return this.orderedLanguages.map(code => ({code, name: this.languageNameService.getLanguageName(code)}));
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
      .filter(lang => !this.orderedLanguages.includes(lang.code))
      .map(lang => lang.name);
  }

  onTranslatedLanguageClick(language: string) {
    const lang = this.languageNameService.getLanguageCode(language)
    const bookSlugInThisLanguage = this.book?.languageVariants.find(t => t.language === lang)?.editionSlug;
    if (!bookSlugInThisLanguage) {
      logger.error("Book ID in this language not found");
      return;
    }
    this.navigateToSlug(bookSlugInThisLanguage)
  }

  openLanguageDropdown() {
    if (!this.authenticated) {
      void this.router.navigate(['/auth'], {queryParams: {returnUrl: `/books/${this.bookSlug}`}});
      return;
    }
    const bookId = this.bookId;
    if (!bookId) {
      logger.error("Book was not found");
      return;
    }

    if (this.languagesAvailableForOrder.length === 0) {
      logger.info("Nothing left to request for this book");
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
          this.orderedLanguages = [...this.orderedLanguages, language];
          this.alertService.open('Translation requested', {appearance: 'positive'}).subscribe();
        },
        error: (error) => {
          logger.error('Failed to order translation:', error);
          this.alertService.open(getErrorMessage(error, 'Couldn\'t order translation'), {appearance: 'negative'}).subscribe();
        }
      });
  }

  private favoriteBlocked = false;

  onBookmarkClick() {
    if (!this.authenticated) {
      void this.router.navigate(['/auth'], {queryParams: {returnUrl: `/books/${this.bookSlug}`}});
      return;
    }
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
            logger.error('Failed to add to favorites:', error);
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
            logger.error('Failed to add to favorites:', error);
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

  cancelOrder(language: LanguageCode) {
    const id = this.originalBookId;
    if (!this.book || !id) {
      return;
    }
    this.withdrawing = language;
    this.readService.cancelTranslationOrder(id, language)
      .pipe(finalize(() => {
        this.withdrawing = null;
      }))
      .subscribe({
        next: () => {
          this.orderedLanguages = this.orderedLanguages.filter(code => code !== language);
          this.alertService.open('Translation request withdrawn', {appearance: 'positive'}).subscribe();
        }, error: (error) => {
          logger.error('Failed to withdraw translation request:', error);
          this.alertService.open(getErrorMessage(error, 'Couldn\'t withdraw translation request'), {appearance: 'negative'}).subscribe();
        }
      });
  }

  getBookmarkColor(): string {
    return this.book?.favorite ? 'orange' : 'grey';
  }

  onOriginalLanguageClick() {
    if (!this.book?.originalId) {
      logger.warn("Original book ID is missing, cannot navigate.");
      return;
    }

    const originalSlug = this.book.languageVariants.find(variant => variant.id === this.book?.originalId)?.editionSlug;
    if (originalSlug) this.navigateToSlug(originalSlug);
  }

  private navigateToSlug(slug: string) {
    void this.router.navigate([`/books/${slug}`]).then(success => {
      if (!success) {
        logger.error("Navigation failed!");
      }
    });
  }

  goToReader() {
    void this.router.navigate([`/reader/${this.bookSlug}`]).then();
  }

  protected readonly signal = signal;

  onClickOutsideLanguageDropdown() {
    this.showLangDropdown = false;
  }
}
