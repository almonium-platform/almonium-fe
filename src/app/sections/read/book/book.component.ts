import {logger} from "../../../shared/logger";
import {getErrorMessage} from '../../../shared/http-error';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, TemplateRef, ViewChild, inject } from "@angular/core";
import {filter, finalize, forkJoin, of, Subject, takeUntil} from "rxjs";
import {ActivatedRoute, Router, RouterLink} from "@angular/router";
import {Meta, Title} from '@angular/platform-browser';
import {TuiNotificationService} from "@taiga-ui/core/components";
import {TuiHintDirective} from "@taiga-ui/core/portals";
import {ReadService} from "../read.service";
import {Book} from "../book.model";
import {LanguageCode} from "../../../models/language.enum";
import {TranslationOrder, TranslationOrderStatus, TranslationRequestQuota} from "../translation-order.model";
import {TuiSkeleton} from "@taiga-ui/kit/directives";
import {LanguageNameService} from "../../../services/language-name.service";
import {SharedLucideIconsModule} from "../../../shared/shared-lucide-icons.module";
import {DatePipe} from "@angular/common";
import {catchError, distinctUntilChanged, map, switchMap} from "rxjs/operators";
import {BookCoverComponent} from '../book-cover/book-cover.component';
import {UserInfoService} from '../../../services/user-info.service';
import {PopupTemplateStateService} from '../../../shared/modals/popup-template/popup-template-state.service';
import {SupportedLanguagesService} from '../../../services/supported-langs.service';
import {Language} from '../../../models/language.model';
import {FormsModule} from '@angular/forms';

/** `other` is the one dashed chip that stands for every language not on the reader's fluent list. */
type ChipState = 'reading' | 'available' | 'asked' | 'requestable' | 'other';

interface LanguageChip {
  code: LanguageCode | null;
  name: string;
  state: ChipState;
}

@Component({
  selector: 'app-book',
  imports: [
    BookCoverComponent,
    TuiHintDirective,
    SharedLucideIconsModule,
    TuiSkeleton,
    RouterLink,
    DatePipe,
    FormsModule,
  ],
  templateUrl: './book.component.html',
  styleUrl: './book.component.less'
})
export class BookComponent implements OnInit, OnDestroy {
  private activatedRoute = inject(ActivatedRoute);
  private alertService = inject(TuiNotificationService);
  private languageNameService = inject(LanguageNameService);
  private readService = inject(ReadService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private userInfoService = inject(UserInfoService);
  private pageTitle = inject(Title);
  private meta = inject(Meta);
  private popupTemplateStateService = inject(PopupTemplateStateService);
  private supportedLanguagesService = inject(SupportedLanguagesService);

  @ViewChild('requestSheet', {static: true}) private requestSheet!: TemplateRef<unknown>;

  private readonly destroy$ = new Subject<void>();
  protected bookId: string | null = null;
  protected bookSlug: string | null = null;
  protected authenticated = false;
  protected premium = false;
  protected book: Book | null = null;
  protected bookLanguage = "";
  private fluentLanguages: LanguageCode[] = [];
  private supportedLanguages: Language[] = [];
  /** The language picked in the sheet when it was opened from the "another language" chip. */
  protected pickedLanguage: LanguageCode | '' = '';
  /** Every request this reader has open, across books; the cap sheet lists this period's. */
  private orders: TranslationOrder[] = [];
  protected quota: TranslationRequestQuota | null = null;
  protected withdrawing: LanguageCode | null = null;
  protected orderLoading = false;
  protected sheetLanguage: LanguageCode | null = null;
  protected bookLoading = true;

  ngOnInit() {
    const user = this.userInfoService.currentUserInfo;
    this.authenticated = user !== null;
    this.premium = user?.premium ?? false;
    this.fluentLanguages = user?.fluentLangs ?? [];
    this.supportedLanguagesService.supportedLanguages$.pipe(takeUntil(this.destroy$)).subscribe(languages => {
      if (languages) this.supportedLanguages = languages;
    });

    this.activatedRoute.paramMap
      .pipe(
        map(params => params.get('slug')),
        filter((slug): slug is string => slug !== null && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)),
        distinctUntilChanged(),
        switchMap(slug => {
          logger.debug(`Route changed or initial load. Fetching book slug: ${slug}`);
          this.bookSlug = slug;
          return this.readService.getPublicBook(slug).pipe(
            catchError(error => {
              logger.error(`Failed to fetch book data for slug ${slug}:`, error);
              this.alertService.open($localize`Failed to load book details.`, {appearance: 'negative'}).subscribe();
              this.book = null;
              this.cdr.detectChanges();
              return of(null);
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(book => {
        this.bookLoading = false;
        if (book) {
          this.book = book;
          this.bookId = book.id;
          this.pageTitle.setTitle($localize`${book.title}:title: by ${book.author}:author: | Almonium`);
          this.meta.updateTag({name: 'description', content: book.description || $localize`Read ${book.title}:title: by ${book.author}:author: on Almonium.`});
          this.bookLanguage = this.languageNameService.getLanguageName(book.language);
          logger.debug(`Successfully loaded book: ${book.title}`);
          this.loadRequests();
          this.cdr.detectChanges();
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get actionBtnLabel() {
    return this.book?.progressPercentage ? $localize`Continue reading` : $localize`Start reading`;
  }

  protected get bookmarkLabel(): string {
    return this.book?.favorite ? $localize`Remove from favourites` : $localize`Add to favourites`;
  }

  /**
   * The book page is public, so request state comes from the reader's own orders rather
   * than the book projection. Without this the chips would vanish on every reload.
   */
  private loadRequests() {
    if (!this.authenticated) {
      this.orders = [];
      return;
    }
    forkJoin({
      orders: this.readService.getTranslationOrders().pipe(catchError(() => of([] as TranslationOrder[]))),
      quota: this.readService.getTranslationRequestQuota().pipe(catchError(() => of(null))),
    }).pipe(takeUntil(this.destroy$)).subscribe(({orders, quota}) => {
      this.orders = orders;
      this.quota = quota;
      this.cdr.detectChanges();
    });
  }

  private get originalBookId(): string | null {
    return this.book?.originalId ?? this.bookId;
  }

  /** Requests open on this book, by language. */
  private get askedHere(): LanguageCode[] {
    const originalId = this.originalBookId;
    return this.orders
      .filter(order => order.bookId === originalId && order.status === TranslationOrderStatus.ASKED)
      .map(order => order.language);
  }

  get pages() {
    if (this.book?.wordCount) {
      const pages = Math.ceil(this.book.wordCount / 250);
      return pages > 0 ? pages : 1;
    }
    return 0;
  }

  protected languageName(code: LanguageCode): string {
    return this.languageNameService.getLanguageName(code);
  }

  /**
   * Solid is the pair the reader will open, outline is one tap to switch, dashed with a plus is
   * requestable: only languages on the fluent list, only on library books, and only when signed in.
   */
  protected get languageChips(): LanguageChip[] {
    const book = this.book;
    if (!book) return [];
    const available = book.languageVariants
      .map(variant => variant.language)
      .filter(language => language !== book.language);
    const defaultPair = this.fluentLanguages.find(language => available.includes(language)) ?? available[0] ?? null;
    const chips: LanguageChip[] = available.map(code => ({
      code,
      name: this.languageName(code),
      state: code === defaultPair ? 'reading' : 'available',
    }));
    if (!this.authenticated) return chips;
    const asked = this.askedHere;
    for (const code of asked) {
      chips.push({code, name: this.languageName(code), state: 'asked'});
    }
    for (const code of this.fluentLanguages) {
      if (code === book.language || available.includes(code) || asked.includes(code)) continue;
      chips.push({code, name: this.languageName(code), state: 'requestable'});
    }
    if (this.otherLanguages.length > 0) {
      chips.push({code: null, name: $localize`Another language`, state: 'other'});
    }
    return chips;
  }

  /** Every supported language the book is not in, does not have, and nobody here has asked for or is fluent in. */
  protected get otherLanguages(): Language[] {
    const book = this.book;
    if (!book || !this.authenticated) return [];
    const taken = new Set<LanguageCode>([
      book.language,
      ...book.languageVariants.map(variant => variant.language),
      ...this.askedHere,
      ...this.fluentLanguages,
    ]);
    return this.supportedLanguages.filter(language => !taken.has(language.code));
  }

  protected get parallelNote(): string | null {
    const requestable = this.languageChips.filter(chip => chip.state === 'requestable');
    if (requestable.length === 0) {
      return this.otherLanguages.length > 0 ? $localize`Missing a language you read? You can ask for it.` : null;
    }
    const names = requestable.map(chip => chip.name);
    return names.length === 1
      ? $localize`${names[0]}:language: is not aligned for this book yet. You can ask for it.`
      : $localize`${names.join(', ')}:languages: are not aligned for this book yet. You can ask for them.`;
  }

  // --- The request sheet (G7) ---

  protected openRequestSheet(language: LanguageCode | null): void {
    if (!this.authenticated) {
      void this.router.navigate(['/auth'], {queryParams: {returnUrl: `/books/${this.bookSlug}`}});
      return;
    }
    this.sheetLanguage = language;
    this.pickedLanguage = '';
    this.popupTemplateStateService.open(this.requestSheet, 'translation-request');
  }

  /** The picker settles the sheet on a language; from there it is the same ask as a fluent chip. */
  protected pickLanguage(code: LanguageCode | ''): void {
    this.pickedLanguage = code;
    this.sheetLanguage = code || null;
  }

  protected closeSheet(): void {
    this.popupTemplateStateService.close();
    this.sheetLanguage = null;
    this.pickedLanguage = '';
  }

  protected get atRequestCap(): boolean {
    const quota = this.quota;
    return quota !== null && quota.limit >= 0 && quota.used >= quota.limit;
  }

  /** The requests that spent this period's allowance, oldest first. */
  protected get periodOrders(): TranslationOrder[] {
    const quota = this.quota;
    if (!quota) return [];
    const start = new Date(quota.periodStartsAt).getTime();
    return this.orders
      .filter(order => order.status === TranslationOrderStatus.ASKED && new Date(order.createdAt).getTime() >= start)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  private get periodMonth(): string {
    return new Intl.DateTimeFormat(undefined, {month: 'long'}).format(new Date());
  }

  protected requestUseLabel(): string | null {
    const quota = this.quota;
    if (!quota || quota.limit < 0) return null;
    const next = quota.used + 1;
    const month = this.periodMonth;
    return quota.limit === 1
      ? $localize`This uses your one request for ${month}:month:.`
      : $localize`This uses ${next}:next: of your ${quota.limit}:limit: requests for ${month}:month:.`;
  }

  protected requestButtonLabel(language: LanguageCode): string {
    return this.orderLoading ? $localize`Requesting…` : $localize`Request ${this.languageName(language)}:language:`;
  }

  protected get capTitle(): string {
    const month = this.periodMonth;
    return this.quota?.limit === 1
      ? $localize`You have used your ${month}:month: request`
      : $localize`You have used your ${month}:month: requests`;
  }

  protected get capCopy(): string {
    const resets = this.quota
      ? new Intl.DateTimeFormat(undefined, {day: 'numeric', month: 'long'}).format(new Date(this.quota.periodEndsAt))
      : '';
    const first = this.periodOrders[0];
    if (first && this.periodOrders.length === 1) {
      return $localize`It went to ${this.languageName(first.language)}:language: on ${first.bookTitle}:book:. Withdraw that one to spend it here instead, or ask again on ${resets}:date:.`;
    }
    return $localize`Withdraw one of them to spend it here instead, or ask again on ${resets}:date:.`;
  }

  protected confirmRequest(): void {
    const language = this.sheetLanguage;
    const id = this.originalBookId;
    if (!language || !id || this.orderLoading) return;
    this.orderLoading = true;
    this.readService.orderTranslation(id, language)
      .pipe(finalize(() => this.orderLoading = false))
      .subscribe({
        next: () => {
          this.closeSheet();
          this.alertService.open($localize`Translation requested`, {appearance: 'positive'}).subscribe();
          this.loadRequests();
        },
        error: (error) => {
          logger.error('Failed to order translation:', error);
          this.alertService.open(getErrorMessage(error, $localize`Couldn't request the translation`), {appearance: 'negative'}).subscribe();
        }
      });
  }

  protected withdrawFromSheet(order: TranslationOrder): void {
    this.withdrawing = order.language;
    this.readService.cancelTranslationOrder(order.bookId, order.language)
      .pipe(finalize(() => this.withdrawing = null))
      .subscribe({
        next: () => {
          this.orders = this.orders.filter(o => o.id !== order.id);
          if (this.quota) this.quota = {...this.quota, used: Math.max(0, this.quota.used - 1)};
          this.cdr.detectChanges();
        },
        error: (error) => this.alertService.open(getErrorMessage(error, $localize`Couldn't withdraw the request`), {appearance: 'negative'}).subscribe(),
      });
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
          this.orders = this.orders.filter(order => !(order.bookId === id && order.language === language));
          if (this.quota) this.quota = {...this.quota, used: Math.max(0, this.quota.used - 1)};
          this.alertService.open($localize`Translation request withdrawn`, {appearance: 'positive'}).subscribe();
        }, error: (error) => {
          logger.error('Failed to withdraw translation request:', error);
          this.alertService.open(getErrorMessage(error, $localize`Couldn't withdraw translation request`), {appearance: 'negative'}).subscribe();
        }
      });
  }

  // --- Favourites ---

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
      message = $localize`Added to favorites`;
      this.readService.favoriteBook(this.bookId, this.book?.language)
        .pipe(finalize(() => this.favoriteBlocked = false))
        .subscribe({
          next: () => {
            this.alertService.open(message, {appearance: 'positive'}).subscribe();
            this.book!.favorite = true;
            this.cdr.detectChanges();
          }, error: (error) => {
            logger.error('Failed to add to favorites:', error);
            this.alertService.open(getErrorMessage(error, $localize`Couldn't add to favorites`), {appearance: 'negative'}).subscribe();
          }
        });
    } else {
      message = $localize`Removed from favorites`;
      this.readService.unfavoriteBook(this.bookId, this.book?.language)
        .pipe(finalize(() => this.favoriteBlocked = false))
        .subscribe({
          next: () => {
            this.alertService.open(message, {appearance: 'positive'}).subscribe();
            this.book!.favorite = false;
            this.cdr.detectChanges();
          }, error: (error) => {
            logger.error('Failed to add to favorites:', error);
            this.alertService.open(getErrorMessage(error, $localize`Couldn't remove favorites`), {appearance: 'negative'}).subscribe();
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

  goToReader() {
    void this.router.navigate([`/reader/${this.bookSlug}`]).then();
  }
}
