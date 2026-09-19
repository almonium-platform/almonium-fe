import {logger} from "../../../shared/logger";
import {AfterViewChecked, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, DOCUMENT, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild, inject} from '@angular/core';
import {ReadService} from '../read.service';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {EMPTY, finalize, Subject, Subscription} from 'rxjs';
import {getErrorMessage} from '../../../shared/http-error';
import {catchError, debounceTime, distinctUntilChanged, takeUntil, throttleTime} from 'rxjs/operators';
import {SharedLucideIconsModule} from "../../../shared/shared-lucide-icons.module";
import {ButtonComponent} from "../../../shared/button/button.component";
import {TuiDataListDropdownManager} from "@taiga-ui/kit/directives";
import {ActivatedRoute, Router, RouterLink} from "@angular/router";
import {Meta, Title} from '@angular/platform-browser';
import {BookLanguageVariant} from "../book.model";
import {TuiActiveZone} from "@taiga-ui/cdk/directives";
import {ParallelFormatPipe} from "./parallel-format.pipe";
import {LoadingIndicatorComponent} from "../../../shared/loading-indicator/loading-indicator.component";
import {ParallelTranslationComponent} from "../parallel-translation/parallel-translation.component";
import {ParallelSettingsComponent} from "../../../parallel-settings/parallel-settings.component";
import {DEFAULT_PARALLEL_MODE, ParallelMode, SIDE_BY_SIDE_MIN_WIDTH, parallelModeLabel} from '../parallel-mode.type';
import {CompanionRow} from '../../../parallel-settings/parallel-settings.component';
import {isReducedMotion} from '../../../services/motion-preference';
import {ParallelModeService} from "../parallel-mode.service";
import {TuiDataList, TuiOptGroup, TuiSliderComponent} from "@taiga-ui/core/components";
import {TuiDropdownDirective} from "@taiga-ui/core/portals";
import {ReaderDomService} from './reader-dom.service';
import {ReaderProgressTracker} from './reader-progress-tracker.service';
import {LearningActivityService} from '../../../services/learning-activity.service';
import {LanguageCode} from '../../../models/language.enum';
import {ReaderPosition} from './reader-position.model';
import {isUuid} from '../../../shared/runtime-validation';
import {UserInfoService} from '../../../services/user-info.service';
import {ProfileSettingsService} from '../../settings/profile/profile-settings.service';
import {LanguageNameService} from '../../../services/language-name.service';
import {ReturnPathService} from '../../../services/return-path.service';
import {CardService} from '../../../services/card.service';
import {BookHtmlPipe} from './book-html.pipe';
import {WordCardComponent} from '../word-card/word-card.component';
import {CEFRLevel} from '../../../models/userinfo.model';
import {BookChapter, displayChapterTitle} from '../book-chapter.model';
import {ChapterWord, wordExcerpt} from '../chapter-vocabulary.model';
import {ChapterVocabularyComponent} from './chapter-vocabulary.component';
import {CertificateMomentComponent} from '../certificate/certificate-moment.component';
import {ChapterPage, bookPercentage, placeForPercentage, splitBookChapters} from './chapter-split';

/** Below this width the contents list is a sheet over the text rather than a rail beside it. */
const CONTENTS_RAIL_MIN_WIDTH = 1281;
/** Below this width the mode picker and the companion menu are one sheet (L7). */
const PHONE_MAX_WIDTH = 600;

/** What the right rail shows: nothing, the chapter's words, or one word's card. */
type RailView = 'none' | 'words' | 'card';

interface WordCardRequest {
  entry: string;
  context: string;
  highlight: string;
  autoSave: boolean;
}

/**
 * The reader is the chapter page (J): one page per chapter with the header at the top, the text,
 * the chapter's words at the end and the next chapter after that. A guest and a member get the
 * same page; signing in adds saving, synced progress and the "Saved" marks, never a different reader.
 */
@Component({
  selector: 'app-reader',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    SharedLucideIconsModule,
    ButtonComponent,
    TuiSliderComponent,
    TuiActiveZone,
    ParallelFormatPipe,
    LoadingIndicatorComponent,
    ParallelTranslationComponent,
    TuiDataListDropdownManager,
    ParallelSettingsComponent,
    TuiDropdownDirective,
    TuiOptGroup,
    TuiDataList,
    BookHtmlPipe,
    WordCardComponent,
    ChapterVocabularyComponent,
    CertificateMomentComponent,
  ],
  templateUrl: './reader.component.html',
  styleUrls: ['./reader.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ReaderDomService, ReaderProgressTracker],
})
export class ReaderComponent implements OnInit, AfterViewInit, OnDestroy, AfterViewChecked {
  private cdRef = inject(ChangeDetectorRef);
  private readService = inject(ReadService);
  private cardService = inject(CardService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private parallelModeService = inject(ParallelModeService);
  private readerDom = inject(ReaderDomService);
  private progressTracker = inject(ReaderProgressTracker);
  private learningActivity = inject(LearningActivityService);
  private userInfoService = inject(UserInfoService);
  private profileSettings = inject(ProfileSettingsService);
  private languageNames = inject(LanguageNameService);
  private returnPath = inject(ReturnPathService);
  private pageTitle = inject(Title);
  private meta = inject(Meta);
  private document = inject(DOCUMENT);

  // --- Element References ---
  @ViewChild('readerContentWrapper') readerContentWrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('readerContent') readerContentRef!: ElementRef<HTMLDivElement>;
  @ViewChild('paginationControls') paginationControlsRef!: ElementRef<HTMLDivElement>;
  @ViewChild('settingsPanel', {read: ElementRef}) private settingsPanel?: ElementRef<HTMLElement>;
  @ViewChild('contentsSheet', {read: ElementRef}) private contentsSheet?: ElementRef<HTMLElement>;
  @ViewChild('contentsToggle', {read: ElementRef}) private contentsToggle?: ElementRef<HTMLElement>;

  // --- The book and its chapters ---
  /** The base edition split into chapter pages, in reading order. */
  protected chapters: ChapterPage[] = [];
  /** The companion edition's pages by chapter key, while a parallel text is loaded. */
  private companionChapters = new Map<number, ChapterPage>();
  /** Processor chapter information by sequence; optional, its absence never blocks reading. */
  protected chapterMetadata: Record<number, BookChapter> = {};
  /** The chapter key from the route; resolved against the split once the text is known. */
  protected currentKey = 0;
  protected currentIndex = -1;
  protected bookHtmlContent = '';
  private baseBookHtmlContent = '';

  protected isLoading = true;
  protected isLoadingParallel = false;
  protected errorMessage: string | null = null;
  /** A companion that could not be loaded is said above the base text, which stays readable. */
  protected parallelError: string | null = null;
  protected missingChapter = false;
  protected bookId: string | null = null;
  protected bookSlug: string | null = null;
  private privateBookId: string | null = null;
  private bookKey = '';
  protected bookTitle = '';
  protected bookAuthor = '';
  protected bookLevel: CEFRLevel | null = null;
  protected signedIn = false;
  /** The end of the last chapter has been reached by a member: the certificate arrives under the final paragraph (K3). */
  protected bookFinished = false;

  // --- Native Scroll State ---
  protected currentScrollPercentage = 0;
  private isScrollingProgrammatically = false;

  // --- RxJS Subjects and Subscriptions ---
  private resizeSubject = new Subject<void>();
  private sliderValueSubject = new Subject<number>();
  private destroy$ = new Subject<void>();
  private scrollEvent$ = new Subject<Event>();

  // --- Constants ---
  private readonly RESIZE_DEBOUNCE_TIME = 300;
  private readonly SLIDER_DEBOUNCE_TIME = 50;
  private readonly SCROLL_UPDATE_THROTTLE_TIME = 100;
  private readonly SCROLL_STEP_PX = 50;

  // --- Touch Scrolling State ---
  private isTouching = false;

  // --- Press and Hold Scrolling State ---
  private scrollIntervalId: ReturnType<typeof setInterval> | null = null;
  private scrollHoldTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isHoldingForScroll = false;
  private readonly SCROLL_HOLD_DELAY = 350;
  private readonly SCROLL_INTERVAL_DELAY = 50;

  // --- Parallel Text ---
  protected parallelVersions: BookLanguageVariant[] = [];
  protected primaryEdition: BookLanguageVariant | undefined;
  protected includeOtherEditionTranslations = true;
  protected isParallelViewActive = false;
  /** Two columns need the window (L2); below it Side by side reads as On demand until it widens. */
  protected sideAvailable = window.innerWidth >= SIDE_BY_SIDE_MIN_WIDTH;
  /** Faint underlines pairing the sentences in Side by side (L8): an account preference; a guest's lasts the visit. */
  protected showPairs = false;

  protected isAtScrollTop = true;
  protected isAtScrollBottom = false;

  protected currentParallelMode: ParallelMode = DEFAULT_PARALLEL_MODE;
  protected fluentLangCode: string | null = null;
  protected companionSlug: string | null = null;
  protected targetLangCode: string | null = null;

  // --- The rails (J4, J5) ---
  protected contentsOpen = false;
  protected railView: RailView = 'none';
  /** The card was opened from the word list, so the rail offers a way back to it. */
  protected railFromWords = false;
  protected wordCard: WordCardRequest | null = null;
  /** Entries this reader already keeps, lower-cased: the "Saved" marks in the word lists. */
  protected savedEntries = new Set<string>();
  /** The current chapter's vocabulary status; `unavailable` removes the Words toggle from the bar. */
  private vocabularyStatus: string | null = null;
  private vocabularyStatusSubscription: Subscription | null = null;
  /** The mode picker (L5) floats above the bottom bar, where its effect is visible behind it. */
  protected parallelSettingsOpen = false;
  protected selectedLookupText = '';
  private selectedLookupContext = '';
  /** A word named in the URL (the auth sheet returning to it) opens its card once the book is known. */
  private pendingWord: WordCardRequest | null = null;

  // --- Where to open ---
  /** The place kept on this device, applied once to the chapter it names. */
  private initialPosition: ReaderPosition | null = null;
  /** How far into the chapter to open, from server progress or a chapter jump. */
  private pendingWithin: number | null = null;
  private initialScrollApplied = false;
  /** `/reader/{slug}` without a local place: the server's percentage picks the chapter, once. */
  private resumeRequested = false;
  private serverPercentage: number | null = null;
  private trackProgress = false;
  private isDestroyed = false;
  private baseLoadSubscription: Subscription | null = null;
  private bookDetailsSubscription: Subscription | null = null;
  private scrollFlagTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private companionNavigationDropdown: TuiDropdownDirective | null = null;
  private structuredData: HTMLScriptElement | null = null;

  // --- Lifecycle Hooks ---

  ngOnInit(): void {
    this.signedIn = this.userInfoService.currentUserInfo !== null;
    this.showPairs = this.userInfoService.currentUserInfo?.uiPreferences.reader.showPairs ?? false;
    this.contentsOpen = !this.isNarrow;
    this.setupResizeListener();
    this.setupSliderListener();
    this.setupScrollListener();
    this.parallelModeService.mode$
      .pipe(takeUntil(this.destroy$))
      .subscribe(mode => {
        if (this.currentParallelMode !== mode) {
          logger.debug('Reader received new parallel mode:', mode);
          if (this.isParallelViewActive && this.fluentLangCode) this.updateScrollState();
          this.currentParallelMode = mode;
          this.cdRef.markForCheck();
        }
      });

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const privateId = params.get('id');
      const slug = params.get('slug');
      const sequence = params.get('sequence') ?? '';
      const key = /^\d{1,4}$/.test(sequence) ? Number(sequence) : NaN;
      const sameBook = privateId ? this.privateBookId === privateId : this.bookSlug === slug && this.bookSlug !== null;
      if (sameBook) {
        // Only the chapter changed: the book stays loaded and the page turns.
        this.currentKey = key;
        this.pendingWithin ??= 0;
        this.applyChapter();
        return;
      }
      this.resetForBook();
      const query = this.route.snapshot.queryParamMap;
      this.resumeRequested = query.get('resume') === '1';
      this.readPendingWord();
      this.currentKey = key;
      if (Number.isNaN(key)) this.handleError($localize`Invalid chapter reference.`);
      else if (privateId) this.openPrivateBook(privateId);
      else if (slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) this.openPublicBook(slug);
      else this.handleError($localize`Invalid book reference.`);
    });
  }

  private readPendingWord(): void {
    const query = this.route.snapshot.queryParamMap;
    const word = query.get('word')?.trim() ?? '';
    if (!word || word.length > 80) return;
    this.pendingWord = {
      entry: word,
      context: (query.get('context') ?? '').slice(0, 500),
      highlight: '',
      autoSave: query.get('save') === '1' && this.signedIn,
    };
  }

  private resetForBook(): void {
    this.chapterMetadata = {};
    this.chapters = [];
    this.companionChapters.clear();
    this.currentIndex = -1;
    this.initialPosition = null;
    this.pendingWithin = null;
    this.serverPercentage = null;
    this.initialScrollApplied = false;
    this.isLoading = true;
    this.missingChapter = false;
    this.errorMessage = null;
    this.parallelError = null;
    this.parallelVersions = [];
    this.primaryEdition = undefined;
    this.includeOtherEditionTranslations = true;
    this.selectedLookupText = '';
    this.selectedLookupContext = '';
    this.wordCard = null;
    this.railView = 'none';
    this.railFromWords = false;
    this.savedEntries = new Set();
    this.vocabularyStatus = null;
    this.parallelSettingsOpen = false;
    this.bookTitle = '';
    this.bookAuthor = '';
    this.bookLevel = null;
    this.bookSlug = null;
    this.privateBookId = null;
    this.bookId = null;
    this.trackProgress = false;
    this.bookFinished = false;
    this.cdRef.markForCheck();
  }

  private openPublicBook(slug: string): void {
    this.bookSlug = slug;
    this.privateBookId = null;
    this.bookKey = `public:${slug}`;
    this.readService.getPublicChapters(slug).pipe(takeUntil(this.destroy$)).subscribe({
      next: chapters => {
        if (this.bookSlug !== slug) return;
        this.chapterMetadata = Object.fromEntries(chapters.map(chapter => [chapter.sequence, chapter]));
        this.describePage();
        this.cdRef.markForCheck();
      },
      // Enrichment is optional: its failure must never prevent reading or navigation.
      error: () => logger.warn('Chapter information is unavailable; keeping text navigation.'),
    });
    this.readService.getPublicBook(slug).pipe(takeUntil(this.destroy$)).subscribe({
      next: book => {
        if (this.bookSlug !== slug) return;
        this.bookId = book.id;
        this.targetLangCode = book.language;
        this.bookTitle = book.title;
        this.bookAuthor = book.author;
        this.bookLevel = book.cefrLevel;
        this.primaryEdition = book.languageVariants.find(variant => variant.id === book.id);
        // Companions are other-language editions only; switching within the language is the book page's Edition row.
        this.parallelVersions = book.languageVariants.filter(variant => variant.id !== book.id && variant.language !== book.language);
        this.trackProgress = this.signedIn;
        this.startCountingReadingTime(book.language);
        this.initialPosition = this.progressTracker.startBook(this.bookKey, this.trackProgress ? book.id : null);
        if (this.trackProgress) {
          this.fetchBookData(book.id);
          this.loadSavedEntries(book.language);
        }
        this.loadBookHtml(slug, true);
        const requested = this.route.snapshot.queryParamMap.get('parallel');
        if (requested && this.parallelVersions.some(variant => variant.editionSlug === requested)) {
          this.selectOption(requested);
        }
        this.openPendingWord();
      },
      error: error => this.handleError(getErrorMessage(error, $localize`Could not load book details.`)),
    });
  }

  private openPrivateBook(id: string): void {
    if (!isUuid(id)) {
      this.handleError($localize`Invalid private book ID.`);
      return;
    }
    this.privateBookId = id;
    this.bookSlug = null;
    this.bookId = id;
    this.bookKey = `private:${id}`;
    this.trackProgress = false;
    this.readService.getBookImport(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: book => {
        if (this.privateBookId !== id) return;
        // A ready private book always has a detected language; only a stale link could reach here without one.
        if (book.language) {
          this.targetLangCode = book.language;
          this.startCountingReadingTime(book.language);
        }
        this.bookTitle = book.title;
        this.initialPosition = this.progressTracker.startBook(this.bookKey, null);
        this.loadBookHtml(id, true);
        this.openPendingWord();
      },
      error: error => this.handleError(getErrorMessage(error, $localize`Could not load private book.`)),
    });
  }

  private loadSavedEntries(language: LanguageCode): void {
    this.cardService.getCardsInLanguage(language).pipe(takeUntil(this.destroy$)).subscribe({
      next: cards => {
        this.savedEntries = new Set(cards.map(card => card.entry.trim().toLowerCase()));
        this.cdRef.markForCheck();
      },
      error: () => logger.warn('Saved words are unavailable; the lists show none as saved.'),
    });
  }

  /** The auth sheet came back to this word: open its card, and drop the ask from the address. */
  private openPendingWord(): void {
    const pending = this.pendingWord;
    if (!pending) return;
    this.pendingWord = null;
    this.showWordCard(pending, false);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {word: null, context: null, save: null},
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  @HostListener('window:beforeunload')
  unloadNotification(): void {
    this.updateScrollState();
    this.progressTracker.saveOnExit(true);
  }

  // --- Chapter pages ---

  protected get currentChapter(): ChapterPage | null {
    return this.chapters[this.currentIndex] ?? null;
  }

  protected get currentTitle(): string {
    const chapter = this.currentChapter;
    return chapter ? displayChapterTitle(chapter.title) : '';
  }

  protected get currentMetadata(): BookChapter | null {
    return this.chapterMetadata[this.currentKey] ?? null;
  }

  protected get chapterList(): BookChapter[] {
    return Object.values(this.chapterMetadata).sort((a, b) => a.sequence - b.sequence);
  }

  protected get previousChapter(): ChapterPage | null { return this.chapters[this.currentIndex - 1] ?? null; }
  protected get nextChapter(): ChapterPage | null { return this.chapters[this.currentIndex + 1] ?? null; }

  protected metadataFor(key: number): BookChapter | null { return this.chapterMetadata[key] ?? null; }
  protected displayTitle(chapter: ChapterPage): string { return displayChapterTitle(chapter.title); }

  protected get bookLink(): string[] {
    return this.privateBookId ? ['/my-books', this.privateBookId] : ['/books', this.bookSlug ?? ''];
  }

  protected chapterLink(key: number): string[] {
    return this.privateBookId ? ['/reader', 'private', this.privateBookId, String(key)] : ['/books', this.bookSlug ?? '', String(key)];
  }

  /** The companion travels with the page; the one-time marks (resume, a returned word) do not. */
  protected get chapterQuery(): Record<string, string> {
    return this.companionSlug ? {parallel: this.companionSlug} : {};
  }

  /** "Chapter 10 of 10 · the end": the rule above the certificate. */
  protected get endLine(): string {
    const count = this.chapters.length;
    return $localize`Chapter ${count}:current: of ${count}:total: · the end`;
  }

  protected get wordsAvailable(): boolean {
    return this.bookSlug !== null && this.vocabularyStatus !== 'unavailable';
  }

  protected get isNarrow(): boolean {
    return window.innerWidth < CONTENTS_RAIL_MIN_WIDTH;
  }

  /** Turns the page: the same route with another chapter, so the book stays loaded. */
  protected goToChapter(key: number): void {
    void this.router.navigate(this.chapterLink(key), {queryParams: this.chapterQuery});
  }

  /** Shows the chapter named by the route once the split is known; a missing one is said, not guessed. */
  private applyChapter(): void {
    if (this.chapters.length === 0) return;
    this.currentIndex = this.chapters.findIndex(chapter => chapter.key === this.currentKey);
    if (this.currentIndex < 0 && this.resumeRequested) {
      // The front door asked for "the first chapter" and this book does not number it 1.
      void this.router.navigate(this.chapterLink(this.chapters[0].key), {queryParams: {...this.chapterQuery, resume: 1}, replaceUrl: true});
      return;
    }
    if (this.currentIndex < 0) {
      this.missingChapter = true;
      this.bookHtmlContent = '';
      this.cdRef.markForCheck();
      return;
    }
    this.missingChapter = false;
    this.errorMessage = null;
    const page = this.isParallelViewActive ? this.companionChapters.get(this.currentKey) : null;
    this.bookHtmlContent = page?.html ?? this.chapters[this.currentIndex].html;
    this.initialScrollApplied = false;
    this.watchVocabularyStatus();
    this.describePage();
    this.tryResumeFromServer();
    this.cdRef.markForCheck();
  }

  private watchVocabularyStatus(): void {
    this.vocabularyStatusSubscription?.unsubscribe();
    this.vocabularyStatus = null;
    if (!this.bookSlug || !this.currentKey) return;
    this.vocabularyStatusSubscription = this.readService.getChapterVocabulary(this.bookSlug, this.currentKey)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: vocabulary => {
          this.vocabularyStatus = vocabulary.status;
          this.cdRef.markForCheck();
        },
        error: () => logger.warn('Chapter vocabulary is unavailable for the bar.'),
      });
  }

  /** A signed-in reader arriving without a local place lands on the chapter their server progress names. */
  private tryResumeFromServer(): void {
    if (!this.resumeRequested || this.serverPercentage === null || this.chapters.length === 0) return;
    this.resumeRequested = false;
    const place = placeForPercentage(this.chapters, this.serverPercentage);
    const target = this.chapters[place.index];
    this.pendingWithin = place.withinChapter;
    if (target.key === this.currentKey) {
      this.initialScrollApplied = false;
      return;
    }
    void this.router.navigate(this.chapterLink(target.key), {queryParams: this.chapterQuery, replaceUrl: true});
  }

  /** The chapter page names itself: title, description and the chapter's place in the book. */
  private describePage(): void {
    const chapter = this.currentChapter;
    if (!chapter || !this.bookTitle) return;
    const language = this.targetLangCode ? this.languageNames.getLanguageName(this.targetLangCode) : '';
    const edition = [language, this.bookLevel].filter(Boolean).join(', ');
    const title = displayChapterTitle(chapter.title);
    this.pageTitle.setTitle(edition
      ? $localize`${title}:chapter: — ${this.bookTitle}:book: (${edition}:edition:) · Almonium`
      : $localize`${title}:chapter: — ${this.bookTitle}:book: · Almonium`);
    const descriptions = this.currentMetadata?.descriptions ?? [];
    this.meta.updateTag({name: 'description', content: descriptions.length
      ? descriptions.join(' ')
      : $localize`Read ${title}:chapter: of ${this.bookTitle}:book: on Almonium.`});
    if (!this.bookSlug) return;
    this.structuredData?.remove();
    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Chapter',
      name: title,
      position: this.currentIndex + 1,
      inLanguage: this.targetLangCode?.toLowerCase(),
      isPartOf: {'@type': 'Book', name: this.bookTitle, author: {'@type': 'Person', name: this.bookAuthor}},
    });
    this.document.head.appendChild(script);
    this.structuredData = script;
  }

  // --- The rails ---

  protected toggleContents(): void {
    this.contentsOpen = !this.contentsOpen;
    if (this.contentsOpen && this.isNarrow) this.railView = 'none';
    this.closeReaderMenus();
    this.cdRef.markForCheck();
  }

  protected onContentsPick(): void {
    if (this.isNarrow) this.contentsOpen = false;
  }

  protected toggleWords(): void {
    if (this.railView === 'words') {
      this.closeRail();
      return;
    }
    this.railView = 'words';
    this.railFromWords = false;
    if (this.isNarrow) this.contentsOpen = false;
    this.closeReaderMenus();
    this.cdRef.markForCheck();
  }

  protected closeRail(): void {
    this.railView = 'none';
    this.wordCard = null;
    this.railFromWords = false;
    this.cdRef.markForCheck();
  }

  protected backToWords(): void {
    this.railView = 'words';
    this.wordCard = null;
    this.railFromWords = false;
    this.cdRef.markForCheck();
  }

  private showWordCard(card: WordCardRequest, fromWords: boolean): void {
    this.wordCard = card;
    this.railView = 'card';
    this.railFromWords = fromWords;
    if (this.isNarrow) this.contentsOpen = false;
    this.closeReaderMenus();
    this.cdRef.markForCheck();
  }

  /** A row in the word list is one target: the rail turns into that word's card, never a page. */
  protected openWordFromList(word: ChapterWord): void {
    const context = wordExcerpt(word).map(part => part.text).join('');
    this.showWordCard({entry: word.lemma, context, highlight: word.surface, autoSave: false}, true);
  }

  protected onWordSaved(entry: string): void {
    this.savedEntries = new Set([...this.savedEntries, entry.trim().toLowerCase()]);
    this.cdRef.markForCheck();
  }

  /** The chapter-end ask (J3): the sheet returns here, to this chapter. */
  protected readFree(): void {
    this.returnPath.remember(this.router.url);
    void this.router.navigate(['/auth'], {fragment: 'sign-up'});
  }

  /** The mode the text is laid out in: the chosen one, unless Side by side lacks the window for it. */
  protected get effectiveMode(): ParallelMode {
    return this.currentParallelMode === 'side' && !this.sideAvailable ? 'demand' : this.currentParallelMode;
  }

  /** Below the phone width the picker and the companion menu are one sheet (L7). */
  protected get isPhone(): boolean {
    return window.innerWidth < PHONE_MAX_WIDTH;
  }

  /**
   * A click or Enter on a sentence group selects it on both sides (L2); in on-demand mode it also
   * opens the group's companion under the paragraph (L3). The same unit again, or plain text, clears.
   */
  protected onContentClick(event: Event): void {
    const content = this.readerContentRef?.nativeElement;
    if (!this.isParallelViewActive || !content || window.getSelection()?.toString().trim()) return;
    const unit = this.readerDom.unitAt(content, event.target);
    const alreadySelected = unit.length > 0 && unit.every(element => element.classList.contains('is-aligned-current'));
    if (unit.length === 0 || alreadySelected) {
      this.clearSelection();
      return;
    }
    this.readerDom.mark(content, unit, 'is-aligned-current');
    if (this.effectiveMode === 'demand') {
      this.readerDom.openCompanionFor(content, unit, !isReducedMotion(this.document.documentElement));
    }
  }

  /** Clears the selected unit and closes the companion block it opened. */
  protected clearSelection(): boolean {
    const content = this.readerContentRef?.nativeElement;
    if (!content) return false;
    const hadSelection = content.querySelector('.is-aligned-current, .companion-block') !== null;
    this.readerDom.mark(content, [], 'is-aligned-current');
    this.readerDom.closeCompanionBlock(content);
    return hadSelection;
  }

  protected captureLookupSelection(): void {
    const selection = window.getSelection();
    const content = this.readerContentRef?.nativeElement;
    if (!selection || selection.isCollapsed || !content || !selection.anchorNode || !content.contains(selection.anchorNode)) {
      return;
    }
    const text = selection.toString().trim().replace(/\s+/g, ' ');
    if (!text || text.length > 80) return;
    const sourceElement = selection.anchorNode.parentElement?.closest('p, li, blockquote, div');
    const paragraph = sourceElement?.textContent?.trim().replace(/\s+/g, ' ') ?? text;
    const context = sentenceAround(paragraph, text).slice(0, 500);
    // A word or a short phrase opens the card in place; a longer stretch goes to Discover as a sentence.
    if (text.split(' ').length <= 3) {
      this.selectedLookupText = '';
      this.selectedLookupContext = '';
      this.showWordCard({entry: text, context, highlight: '', autoSave: false}, false);
    } else {
      this.selectedLookupText = text;
      this.selectedLookupContext = context;
    }
    this.cdRef.markForCheck();
  }

  /** The language the card translates into: the pair being read, else the reader's first other fluent language. */
  protected get cardTranslationLanguage(): LanguageCode {
    if (this.fluentLangCode && this.fluentLangCode !== this.targetLangCode) return this.fluentLangCode as LanguageCode;
    const fluent = this.userInfoService.currentUserInfo?.fluentLangs.find(language => language !== this.targetLangCode);
    if (fluent) return fluent;
    return this.targetLangCode === LanguageCode.EN ? LanguageCode.UK : LanguageCode.EN;
  }

  protected get cardLanguage(): LanguageCode {
    return (this.targetLangCode as LanguageCode | null) ?? LanguageCode.EN;
  }

  protected openSelectionInDiscover(): void {
    if (!this.selectedLookupText) return;
    void this.router.navigate(['/discover'], {
      queryParams: {text: this.selectedLookupText, context: this.selectedLookupContext},
    });
  }

  protected dismissLookupSelection(): void {
    this.selectedLookupText = '';
    this.selectedLookupContext = '';
    window.getSelection()?.removeAllRanges();
    this.cdRef.markForCheck();
  }

  private handleLoadError(loadType: 'base' | 'parallel', message: string): void {
    if (loadType === 'parallel') {
      logger.error('Reader Error:', message);
      this.parallelError = $localize`The companion text could not be loaded: ${message}:message:`;
      this.isLoadingParallel = false;
      this.revertToBaseContent();
      this.cdRef.markForCheck();
      return;
    }
    this.handleError($localize`Error loading base content: ${message}:message:`);
    this.isLoading = false;
    this.cdRef.markForCheck();
  }

  ngAfterViewInit(): void {
    this.updateScrollState();
    this.cdRef.markForCheck();
  }

  ngAfterViewChecked(): void {
    this.attemptInitialScroll();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.clearScrollHoldTimers();
    this.clearScheduledWork();
    this.baseLoadSubscription?.unsubscribe();
    this.bookDetailsSubscription?.unsubscribe();
    this.parallelLoadSubscription?.unsubscribe();
    this.vocabularyStatusSubscription?.unsubscribe();
    this.updateScrollState();
    this.progressTracker.saveOnExit(false);
    this.learningActivity.stop();
    this.structuredData?.remove();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Reading counts for the harness whether or not the book's own progress is stored on the server. */
  private startCountingReadingTime(language: LanguageCode): void {
    if (this.userInfoService.currentUserInfo) this.learningActivity.start('READ', language);
  }

  private loadBookHtml(bookId: string, isBase = false): void {
    if (isBase) {
      this.isLoading = true;
      this.isParallelViewActive = false;
    } else {
      this.isLoadingParallel = true;
    }
    this.errorMessage = null;
    if (isBase) this.baseBookHtmlContent = '';
    this.bookHtmlContent = '';
    this.cdRef.markForCheck();

    const stream$ = isBase
      ? this.privateBookId
        ? this.readService.loadPrivateBook(bookId)
        : this.readService.loadPublicBook(bookId)
      : this.readService.getPublicParallelText(bookId, this.companionSlug!);

    if (isBase) this.baseLoadSubscription?.unsubscribe();
    const subscription = stream$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.status === 200 && response.body) {
          try {
            const fetchedHtml = this.readerDom.decode(response.body);
            if (isBase) {
              this.baseBookHtmlContent = fetchedHtml;
              this.chapters = splitBookChapters(fetchedHtml, this.targetLangCode);
            } else {
              this.companionChapters = new Map(splitBookChapters(fetchedHtml, this.targetLangCode).map(page => [page.key, page]));
              this.isParallelViewActive = true;
            }
            this.isLoading = false;
            if (!isBase) this.isLoadingParallel = false;
            this.errorMessage = null;
            logger.debug(`Loaded ${isBase ? 'base' : 'parallel'} HTML content.`);
            this.applyChapter();
          } catch (e) {
            this.handleLoadError(isBase ? 'base' : 'parallel', $localize`Failed to decode content: ${e instanceof Error ? e.message : String(e)}:reason:`);
          }
        } else {
          this.handleLoadError(isBase ? 'base' : 'parallel', $localize`Failed to load content. Status: ${response.status}:status:`);
        }
      },
      error: (error) => this.handleLoadError(isBase ? 'base' : 'parallel', getErrorMessage(error, $localize`Unknown error loading content.`)),
    });
    if (isBase) this.baseLoadSubscription = subscription;
  }

  private get presentation(): string {
    return this.isParallelViewActive ? `parallel:${this.companionSlug}:${this.effectiveMode}` : 'base';
  }

  /** Opens the chapter at its kept place, once its text has laid out. */
  private attemptInitialScroll(): void {
    if (this.isDestroyed || this.initialScrollApplied || this.isLoading || this.isLoadingParallel || this.missingChapter) return;
    const wrapper = this.readerContentWrapperRef?.nativeElement;
    const content = this.readerContentRef?.nativeElement;
    if (!wrapper || !content || !this.bookHtmlContent || wrapper.scrollHeight <= 0) return;

    const position = this.initialPosition;
    if (position?.chapter === this.currentKey) {
      const resolvable = position.presentation === this.presentation ? position : {...position, anchor: null};
      const targetScrollTop = this.readerDom.scrollTopForPosition(wrapper, content, resolvable);
      logger.debug(`Restoring the kept place at ${targetScrollTop}px.`);
      this.setScrollTop(targetScrollTop);
      this.initialPosition = null;
    } else if (this.pendingWithin !== null) {
      this.scrollToPercentage(this.pendingWithin * 100);
      this.pendingWithin = null;
    } else {
      this.setScrollTop(0);
    }
    this.initialScrollApplied = true;
    this.updateScrollState();
  }

  private revertToBaseContent(): void {
    if (!this.isParallelViewActive && this.fluentLangCode === null && this.companionChapters.size === 0) return;
    this.isParallelViewActive = false;
    this.companionChapters.clear();
    this.fluentLangCode = null;
    this.companionSlug = null;
    this.isLoadingParallel = false;
    // The same place in the same chapter, in the base rendering.
    this.pendingWithin = this.currentScrollPercentage / 100;
    this.applyChapter();
  }

  /** Server-side progress and the parallel options a signed-in reader has. */
  private fetchBookData(bookId: string): void {
    this.bookDetailsSubscription?.unsubscribe();
    this.bookDetailsSubscription = this.readService.getMiniBookDetailsById(bookId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (book) => {
        if (!book) return;
        this.targetLangCode = book.language;
        this.parallelVersions = book.languageVariants.filter(t => t.id !== bookId && t.language !== book.language);
        this.primaryEdition = book.languageVariants.find(t => t.id === bookId);
        this.serverPercentage = book.progressPercentage ?? 0;
        this.tryResumeFromServer();
        this.cdRef.markForCheck();
      },
      error: (error) => logger.error('Error fetching book details for parallel options:', error)
    });
  }

  private handleError(message: string): void {
    logger.error("Reader Error:", message);
    this.errorMessage = message;
    this.isLoading = false;
    this.currentScrollPercentage = 0;
    this.cdRef.markForCheck();
  }

  // --- Event Listeners Setup ---
  private setupResizeListener(): void {
    this.resizeSubject.pipe(
      debounceTime(this.RESIZE_DEBOUNCE_TIME),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.sideAvailable = window.innerWidth >= SIDE_BY_SIDE_MIN_WIDTH;
      this.updateScrollState();
      this.cdRef.markForCheck();
    });
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.resizeSubject.next();
  }

  private setupSliderListener(): void {
    this.sliderValueSubject.pipe(
      debounceTime(this.SLIDER_DEBOUNCE_TIME),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(percentage => this.scrollToPercentage(percentage));
  }

  private setupScrollListener(): void {
    this.scrollEvent$.pipe(
      throttleTime(this.SCROLL_UPDATE_THROTTLE_TIME, undefined, {leading: true, trailing: true}),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      if (!this.isScrollingProgrammatically) {
        this.ngZone.run(() => {
          this.updateScrollState();
          this.cdRef.markForCheck();
        });
      }
    });
  }

  // --- Scrolling Logic (Native) ---

  protected onWrapperScroll(event: Event): void {
    this.ngZone.runOutsideAngular(() => this.scrollEvent$.next(event));
  }

  private updateScrollState(): void {
    if (!this.readerContentWrapperRef) return;
    const state = this.readerDom.getScrollState(this.readerContentWrapperRef.nativeElement);
    this.isAtScrollTop = state.isAtTop;
    this.isAtScrollBottom = state.isAtBottom;
    if (state.percentage !== this.currentScrollPercentage) this.currentScrollPercentage = state.percentage;
    if (state.isAtBottom && this.initialScrollApplied && this.trackProgress && this.bookId && this.currentIndex >= 0 && !this.nextChapter) {
      this.bookFinished = true;
    }

    if (this.initialScrollApplied && this.currentIndex >= 0 && this.readerContentRef?.nativeElement) {
      const captured = this.readerDom.capturePosition(
        this.readerContentWrapperRef.nativeElement,
        this.readerContentRef.nativeElement,
      );
      const position: ReaderPosition = {...captured, chapter: this.currentKey, presentation: this.presentation};
      this.progressTracker.update(
        bookPercentage(this.chapters, this.currentIndex, state.percentage / 100),
        position,
        this.chapters.length ? {chapter: this.currentKey} : null,
      );
    }
  }

  private scrollToPercentage(percentage: number): void {
    if (!this.readerContentWrapperRef?.nativeElement) return;
    const element = this.readerContentWrapperRef.nativeElement;
    const targetScrollTop = this.readerDom.scrollTopForPercentage(element, percentage);
    this.setScrollTop(targetScrollTop ?? 0);
  }

  private setScrollTop(value: number): void {
    if (!this.readerContentWrapperRef) return;
    const element = this.readerContentWrapperRef.nativeElement;
    const clampedValue = this.readerDom.clampScrollTop(element, value);
    if (Math.round(element.scrollTop) === Math.round(clampedValue)) return;

    this.isScrollingProgrammatically = true;
    element.scrollTop = clampedValue;
    this.ngZone.run(() => {
      this.updateScrollState();
      this.cdRef.markForCheck();
    });
    this.ngZone.runOutsideAngular(() => {
      if (this.scrollFlagTimeoutId !== null) clearTimeout(this.scrollFlagTimeoutId);
      this.scrollFlagTimeoutId = setTimeout(() => {
        this.scrollFlagTimeoutId = null;
        this.isScrollingProgrammatically = false;
      }, this.SCROLL_UPDATE_THROTTLE_TIME + 50);
    });
  }

  protected onSliderInput(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.currentScrollPercentage = value;
    this.sliderValueSubject.next(value);
  }

  // --- Navigation ---

  /** The arrows are only ever absent at the book's ends; at a chapter's end they turn the page. */
  protected get canGoForward(): boolean { return !this.isAtScrollBottom || this.nextChapter !== null; }
  protected get canGoBack(): boolean { return !this.isAtScrollTop || this.previousChapter !== null; }

  protected nextPage(): void {
    if (!this.readerContentWrapperRef) return;
    const element = this.readerContentWrapperRef.nativeElement;
    if (this.isAtScrollBottom) {
      const next = this.nextChapter;
      if (next) this.goToChapter(next.key);
      return;
    }
    this.setScrollTop(element.scrollTop + element.clientHeight * 0.95);
  }

  protected prevPage(): void {
    if (!this.readerContentWrapperRef) return;
    const element = this.readerContentWrapperRef.nativeElement;
    if (this.isAtScrollTop) {
      const previous = this.previousChapter;
      if (previous) this.goToChapter(previous.key);
      return;
    }
    this.setScrollTop(element.scrollTop - element.clientHeight * 0.95);
  }

  private performScrollStep(direction: 'prev' | 'next'): void {
    if (!this.readerContentWrapperRef) return;
    const element = this.readerContentWrapperRef.nativeElement;
    this.setScrollTop(element.scrollTop + (direction === 'prev' ? -this.SCROLL_STEP_PX : this.SCROLL_STEP_PX));
  }

  // --- Touch & Hold Scroll ---
  protected onTouchStart(): void {
    this.isTouching = true;
    this.clearScrollHoldTimers();
  }

  protected onTouchMove(): void { /* Browser handles native scroll */ }
  protected onTouchEnd(): void { this.isTouching = false; }
  protected onTouchCancel(): void { this.isTouching = false; }

  protected clearScrollHoldTimers(): void {
    if (this.scrollHoldTimeoutId) {
      clearTimeout(this.scrollHoldTimeoutId);
      this.scrollHoldTimeoutId = null;
    }
    if (this.scrollIntervalId) {
      clearInterval(this.scrollIntervalId);
      this.scrollIntervalId = null;
    }
    this.isHoldingForScroll = false;
  }

  protected startScrollHold(direction: 'prev' | 'next'): void {
    if (this.isTouching) return;
    this.clearScrollHoldTimers();
    this.isHoldingForScroll = false;
    this.scrollHoldTimeoutId = setTimeout(() => {
      this.isHoldingForScroll = true;
      this.scrollIntervalId = setInterval(() => {
        if (this.isTouching) {
          this.clearScrollHoldTimers();
          return;
        }
        this.performScrollStep(direction);
      }, this.SCROLL_INTERVAL_DELAY);
    }, this.SCROLL_HOLD_DELAY);
  }

  protected stopScrollHold(triggerAction: 'prev' | 'next'): void {
    const wasHoldScrollActive = this.isHoldingForScroll;
    this.clearScrollHoldTimers();
    if (!wasHoldScrollActive && !this.isTouching) {
      if (triggerAction === 'prev') this.prevPage();
      else this.nextPage();
    }
  }

  // --- Keyboard Nav ---
  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (this.isLoading) return;
    const target = event.target as HTMLElement;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target?.tagName?.toUpperCase())) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    let handled = false;
    switch (event.key) {
      case 'ArrowLeft':
      case 'PageUp':
        this.prevPage();
        handled = true;
        break;
      case 'ArrowRight':
      case 'PageDown':
      case ' ':
        this.nextPage();
        handled = true;
        break;
      case 'ArrowUp':
        this.performScrollStep('prev');
        handled = true;
        break;
      case 'ArrowDown':
        this.performScrollStep('next');
        handled = true;
        break;
      case 'Home':
        this.setScrollTop(0);
        handled = true;
        break;
      case 'End':
        if (this.readerContentWrapperRef) {
          const element = this.readerContentWrapperRef.nativeElement;
          this.setScrollTop(element.scrollHeight - element.clientHeight);
        }
        handled = true;
        break;
      case 'Escape':
        if (this.parallelSettingsOpen) {
          this.closeParallelSettings();
          handled = true;
        } else if (this.clearSelection()) {
          handled = true;
        } else if (this.railView !== 'none') {
          this.closeRail();
          handled = true;
        } else if (this.contentsOpen && this.isNarrow) {
          this.contentsOpen = false;
          this.cdRef.markForCheck();
          handled = true;
        }
        break;
    }
    if (handled) event.preventDefault();
  }

  // --- Whitespace Click ---
  /** A click on the empty ground beside the column turns the page; anything with content in it does not. */
  protected onWrapperClick(event: MouseEvent): void {
    if (!this.readerContentWrapperRef) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const isGround = ['reader-content-wrapper', 'reader-reading-layout', 'reader-column'].some(name => target.classList.contains(name));
    if (!isGround) return;
    const wrapperRect = this.readerContentWrapperRef.nativeElement.getBoundingClientRect();
    if (event.clientX > wrapperRect.left + wrapperRect.width / 2) this.nextPage();
    else this.prevPage();
  }

  /** The unit under the pointer or focus lights on both sides at once (L); leaving the text clears it. */
  protected onContentHover(event: Event): void {
    const content = this.readerContentRef?.nativeElement;
    if (!content || !this.isParallelViewActive) return;
    this.readerDom.mark(content, this.readerDom.unitAt(content, event.target), 'is-lit');
  }

  protected clearLit(): void {
    const content = this.readerContentRef?.nativeElement;
    if (content) this.readerDom.mark(content, [], 'is-lit');
  }

  @HostListener('document:click', ['$event'])
  protected closeOverlays(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Node)) return;
    // The picker closes on any click outside it and outside what opens it.
    if (this.parallelSettingsOpen
      && !this.settingsPanel?.nativeElement.contains(target)
      && !(target instanceof Element && target.closest('.chapter-head__mode, app-parallel-translation, tui-data-list'))) {
      this.closeParallelSettings();
    }
    // A click away from the text clears the selected sentence group (L).
    if (target instanceof Element && !target.closest('.reader-content, .parallel-settings-panel, tui-data-list, .pagination-controls')) {
      this.clearSelection();
    }
    // The contents sheet on a narrow screen closes like a menu.
    if (this.contentsOpen && this.isNarrow
      && !this.contentsSheet?.nativeElement.contains(target)
      && !this.contentsToggle?.nativeElement.contains(target)) {
      this.contentsOpen = false;
      this.cdRef.markForCheck();
    }
  }

  /**
   * The bar's companion button: on a phone, or with a companion open, it is the picker (L5, L7),
   * which also lists the editions on a phone; otherwise the companion menu.
   */
  protected openCompanionMenu(dropdown: TuiDropdownDirective): void {
    if (this.isNarrow) this.contentsOpen = false;
    this.companionNavigationDropdown = dropdown;
    if (this.isPhone || this.isParallelViewActive) {
      dropdown.toggle(false);
      this.toggleParallelSettings();
      return;
    }
    this.closeParallelSettings();
    dropdown.toggle(true);
    this.cdRef.markForCheck();
  }

  /** The picker's Change link: the companion menu in place of the picker. */
  protected changeCompanion(): void {
    this.closeParallelSettings();
    this.companionNavigationDropdown?.toggle(true);
    this.cdRef.markForCheck();
  }

  /** The companion edition now open, if any. */
  protected get companionEdition(): BookLanguageVariant | undefined {
    return this.parallelVersions.find(item => item.editionSlug === this.companionSlug);
  }

  /** The header's pair line (L1): codes in mono, then the companion's language and kind in words. */
  protected get primaryCode(): string {
    return [this.targetLangCode, this.bookLevel].filter(Boolean).join(' ');
  }

  protected get companionCode(): string {
    const edition = this.companionEdition;
    return edition ? [edition.language, edition.cefrLevel].filter(Boolean).join(' ') : '';
  }

  protected get companionWords(): string {
    const edition = this.companionEdition;
    return edition ? `${this.languageNames.getLanguageName(edition.language)}, ${this.editionKind(edition)}` : '';
  }

  /** The picker's companion line (L5): language and level, then the kind. */
  protected get companionLine(): string {
    const edition = this.companionEdition;
    if (!edition) return '';
    const name = [this.languageNames.getLanguageName(edition.language), edition.cefrLevel].filter(Boolean).join(' ');
    return $localize`Companion: ${name}:companion:, ${this.editionKind(edition)}:kind:`;
  }

  protected get modeLabel(): string {
    return parallelModeLabel(this.effectiveMode);
  }

  /** The edition's kind in words; an indirect translation says what it translates. */
  protected editionKind(edition: BookLanguageVariant): string {
    if (this.isOtherEditionTranslation(edition)) return $localize`translation of the original`;
    switch (edition.editionType) {
      case 'machine_translation': return $localize`machine translation`;
      case 'human_translation': return $localize`translation`;
      case 'adaptation': return $localize`adaptation`;
      case 'original': return $localize`original`;
      default: return $localize`edition`;
    }
  }

  /** The phone sheet's edition rows (L7): the open one first, then the rest the menu would list. */
  protected get companionRows(): CompanionRow[] {
    const current = this.companionEdition;
    const rows = [...(current ? [current] : []), ...this.availableEditions];
    return rows.map(edition => ({
      slug: edition.editionSlug,
      name: [this.languageNames.getLanguageName(edition.language), edition.cefrLevel].filter(Boolean).join(' · '),
      kind: this.editionKind(edition),
      code: edition.language,
      selected: edition.editionSlug === this.companionSlug,
    }));
  }

  protected closeReaderMenus(): void {
    this.companionNavigationDropdown?.toggle(false);
    this.closeParallelSettings();
  }

  get availableEditions(): BookLanguageVariant[] {
    return this.parallelVersions.filter(edition => edition.editionSlug !== this.companionSlug
      && (this.includeOtherEditionTranslations || !this.isOtherEditionTranslation(edition)));
  }

  isOtherEditionTranslation(edition: BookLanguageVariant): boolean {
    return this.primaryEdition?.editionType === 'adaptation'
      && ['machine_translation', 'human_translation'].includes(edition.editionType ?? '')
      && !!edition.sourceEditionSlug && edition.sourceEditionSlug !== this.primaryEdition.editionSlug;
  }

  get hasOtherEditionTranslations(): boolean {
    return this.parallelVersions.some(edition => this.isOtherEditionTranslation(edition));
  }

  toggleOtherEditionTranslations(): void {
    this.includeOtherEditionTranslations = !this.includeOtherEditionTranslations;
    const selected = this.parallelVersions.find(edition => edition.editionSlug === this.companionSlug);
    if (!this.includeOtherEditionTranslations && selected && this.isOtherEditionTranslation(selected)) {
      this.selectOption(null);
    }
  }

  editionLabel(edition: BookLanguageVariant): string {
    const kind = edition.editionType?.replaceAll('_', ' ') ?? 'edition';
    const origin = this.isOtherEditionTranslation(edition) ? ' · based on another edition, not this adaptation' : '';
    return `${edition.language} · ${edition.cefrLevel ?? 'level pending'} · ${kind}${origin}`;
  }

  get companionLabel(): string {
    const edition = this.parallelVersions.find(item => item.editionSlug === this.companionSlug);
    return edition ? this.editionLabel(edition) : '';
  }

  private parallelLoadSubscription: Subscription | null = null;

  private clearScheduledWork(): void {
    if (this.scrollFlagTimeoutId !== null) {
      clearTimeout(this.scrollFlagTimeoutId);
      this.scrollFlagTimeoutId = null;
    }
  }

  selectOption(editionSlug: string | null): void {
    const edition = this.parallelVersions.find(item => item.editionSlug === editionSlug);
    const langCode = edition?.language ?? null;
    if (editionSlug !== null && editionSlug === this.companionSlug) return;

    this.parallelLoadSubscription?.unsubscribe();
    this.parallelError = null;
    this.fluentLangCode = langCode;
    this.companionSlug = edition?.editionSlug ?? null;

    if (langCode && this.bookSlug) {
      this.isParallelViewActive = false;
      this.isLoadingParallel = true;
      this.errorMessage = null;
      this.cdRef.markForCheck();

      this.parallelLoadSubscription = this.readService.getPublicParallelText(this.bookSlug, this.companionSlug!).pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoadingParallel = false;
          this.cdRef.markForCheck();
        }),
        catchError(error => {
          this.handleLoadError('parallel', getErrorMessage(error, $localize`Unknown error fetching parallel content.`));
          this.revertToBaseContent();
          return EMPTY;
        })
      ).subscribe({
        next: (response) => {
          if (response.status === 200 && response.body) {
            try {
              const html = this.readerDom.decode(response.body);
              this.companionChapters = new Map(splitBookChapters(html, this.targetLangCode).map(page => [page.key, page]));
              this.isParallelViewActive = true;
              this.errorMessage = null;
              // The same place in the same chapter, now in the pair.
              this.pendingWithin = this.currentScrollPercentage / 100;
              this.applyChapter();
            } catch (e) {
              this.handleLoadError('parallel', $localize`Failed to decode parallel content: ${e instanceof Error ? e.message : String(e)}:reason:`);
              this.revertToBaseContent();
            }
          } else {
            this.handleLoadError('parallel', $localize`Failed to load parallel content. Status: ${response.status}:status:`);
            this.revertToBaseContent();
          }
          this.cdRef.markForCheck();
        },
        error: (err) => {
          logger.error("Unexpected error in parallel load subscription:", err);
          this.handleLoadError('parallel', $localize`An unexpected error occurred during parallel load.`);
          this.revertToBaseContent();
          this.cdRef.markForCheck();
        }
      });
    } else {
      this.revertToBaseContent();
      if (this.isLoadingParallel) {
        this.isLoadingParallel = false;
        this.cdRef.markForCheck();
      }
    }
  }

  /** The picker's pairs switch (L8): the page behind it repaints at once; a member's choice is kept on the account. */
  protected toggleShowPairs(): void {
    this.showPairs = !this.showPairs;
    this.cdRef.markForCheck();
    const user = this.userInfoService.currentUserInfo;
    if (!user) return;
    const uiPreferences = structuredClone(user.uiPreferences);
    uiPreferences.reader.showPairs = this.showPairs;
    this.userInfoService.updateUserInfo({uiPreferences});
    this.profileSettings.saveUiPreferences(uiPreferences).subscribe({
      error: (error: unknown) => logger.warn('Could not save the sentence-pairs preference', error),
    });
  }

  protected toggleParallelSettings(): void {
    this.parallelSettingsOpen = !this.parallelSettingsOpen;
    if (this.parallelSettingsOpen && this.isNarrow) this.contentsOpen = false;
    this.cdRef.markForCheck();
  }

  protected closeParallelSettings(): void {
    if (!this.parallelSettingsOpen) return;
    this.parallelSettingsOpen = false;
    this.cdRef.markForCheck();
  }
}

/** The sentence a word was met in: the paragraph cut at the sentence ends on either side of the hit. */
export function sentenceAround(paragraph: string, hit: string): string {
  const index = paragraph.toLowerCase().indexOf(hit.toLowerCase());
  if (index < 0) return paragraph;
  const boundary = /[.!?…]["”»']?\s/g;
  let start = 0;
  let end = paragraph.length;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(paragraph)) !== null) {
    const cut = match.index + match[0].length;
    if (cut <= index) start = cut;
    else if (match.index >= index + hit.length) {
      end = match.index + match[0].trimEnd().length;
      break;
    }
  }
  return paragraph.slice(start, end).trim();
}
