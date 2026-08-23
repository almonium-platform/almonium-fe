import {logger} from "../../../shared/logger";
import {AfterViewChecked, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild, inject} from '@angular/core';
import {ReadService} from '../read.service';
import {CommonModule, SlicePipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {EMPTY, finalize, Subject, Subscription} from 'rxjs';
import {getErrorMessage} from '../../../shared/http-error';
import {catchError, debounceTime, distinctUntilChanged, takeUntil, throttleTime} from 'rxjs/operators';
import {SharedLucideIconsModule} from "../../../shared/shared-lucide-icons.module";
import {ButtonComponent} from "../../../shared/button/button.component";
import {TuiDataListDropdownManager} from "@taiga-ui/kit/directives";
import {ActivatedRoute, Router} from "@angular/router";
import {BookLanguageVariant} from "../book.model";
import {TuiActiveZone} from "@taiga-ui/cdk/directives";
import {ParallelFormatPipe} from "./parallel-format.pipe";
import {LoadingIndicatorComponent} from "../../../shared/loading-indicator/loading-indicator.component";
import {ParallelTranslationComponent} from "../parallel-translation/parallel-translation.component";
import {PopupTemplateStateService} from "../../../shared/modals/popup-template/popup-template-state.service";
import {ParallelSettingsComponent} from "../../../parallel-settings/parallel-settings.component";
import {DEFAULT_PARALLEL_MODE, ParallelMode} from '../parallel-mode.type';
import {ParallelModeService} from "../parallel-mode.service";
import {TuiDataList, TuiOptGroup, TuiSliderComponent} from "@taiga-ui/core/components";
import {TuiDropdownDirective} from "@taiga-ui/core/portals";
import {ReaderChapter, ReaderDomService} from './reader-dom.service';
import {ReaderProgressTracker} from './reader-progress-tracker.service';
import {ReaderPosition} from './reader-position.model';
import {isUuid} from '../../../shared/runtime-validation';
import {UserInfoService} from '../../../services/user-info.service';
import {BookHtmlPipe} from './book-html.pipe';

@Component({
  selector: 'app-reader',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SharedLucideIconsModule,
    ButtonComponent,
    TuiSliderComponent,
    SlicePipe,
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
  ],
  templateUrl: './reader.component.html',
  styleUrls: ['./reader.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ReaderDomService, ReaderProgressTracker],
})
export class ReaderComponent implements OnInit, AfterViewInit, OnDestroy, AfterViewChecked {
  private cdRef = inject(ChangeDetectorRef);
  private readService = inject(ReadService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private parallelModeService = inject(ParallelModeService);
  private popupTemplateStateService = inject(PopupTemplateStateService);
  private readerDom = inject(ReaderDomService);
  private progressTracker = inject(ReaderProgressTracker);
  private userInfoService = inject(UserInfoService);

  // --- Element References ---
  @ViewChild('readerContentWrapper') readerContentWrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('readerContent') readerContentRef!: ElementRef<HTMLDivElement>;
  @ViewChild('paginationControls') paginationControlsRef!: ElementRef<HTMLDivElement>;
  @ViewChild('tocTrigger', {read: ElementRef}) private tocTrigger?: ElementRef<HTMLElement>;

  // --- State Properties ---
  protected chapterNav: ReaderChapter[] = [];
  private hasMeasuredChapters = false; // Flag to ensure we measure only once

  protected bookHtmlContent = ''; // Store the raw HTML from backend
  protected baseBookHtmlContent = ''; // Store the raw HTML from backend

  protected isLoading = true;          // General loading state
  protected isLoadingParallel = false; // Specific loading state for parallel text
  protected errorMessage: string | null = null;
  protected bookId: string | null = null;
  private bookSlug: string | null = null;
  private privateBookId: string | null = null;
  private trackProgress = false;

  // --- Native Scroll State ---
  protected currentScrollPercentage = 0; // Current scroll position (0-100)
  private isScrollingProgrammatically = false;  // Flag to prevent scroll event loops

  // --- RxJS Subjects and Subscriptions ---
  private resizeSubject = new Subject<void>();
  private sliderValueSubject = new Subject<number>(); // Represents target scroll PERCENTAGE
  private destroy$ = new Subject<void>();
  private scrollEvent$ = new Subject<Event>(); // For handling scroll events

  // --- Constants ---
  private readonly RESIZE_DEBOUNCE_TIME = 300;
  private readonly SLIDER_DEBOUNCE_TIME = 50; // Debounce slider input affecting scroll
  private readonly SCROLL_UPDATE_THROTTLE_TIME = 100; // Throttle scroll events updating the slider
  private readonly SCROLL_STEP_PX = 50; // Pixel step for keyboard/hold scroll

  // --- Touch Scrolling State ---
  private isTouching = false; // Simpler flag now

  // --- Press and Hold Scrolling State ---
  private scrollIntervalId: ReturnType<typeof setInterval> | null = null;
  private scrollHoldTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isHoldingForScroll = false;
  private readonly SCROLL_HOLD_DELAY = 350;
  private readonly SCROLL_INTERVAL_DELAY = 50;

  // --- Parallel Text (Placeholder State) ---
  protected parallelVersions: BookLanguageVariant[] = [];
  protected isParallelViewActive = false; // Still needed to know *if* content has translations
  private currentlyOpenFluentSpan: HTMLElement | null = null;

  protected isAtScrollTop = true; // ADDED: True initially
  protected isAtScrollBottom = false; // ADDED: False initially

  protected currentParallelMode: ParallelMode = DEFAULT_PARALLEL_MODE;
  protected fluentLangCode: string | null = null;
  protected targetLangCode: string | null = null; // Language of the book being read
  protected selectedLookupText = '';
  private selectedLookupContext = '';

  private isSyncingHeights = false;

  private initialScrollPercentage: number | null = null;
  private initialPosition: ReaderPosition | null = null;
  private initialScrollApplied = false;
  private isDestroyed = false;
  private baseLoadSubscription: Subscription | null = null;
  private bookDetailsSubscription: Subscription | null = null;
  private heightSyncTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private scrollFlagTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private chapterScrollTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private chapterMeasurementFrameId: number | null = null;
  private chapterNavigationDropdown: TuiDropdownDirective | null = null;

  private needsHeightSync = false;

  // --- Lifecycle Hooks ---

  ngOnInit(): void {
    this.setupResizeListener();
    this.setupSliderListener();
    this.setupScrollListener();
    this.parallelModeService.mode$
      .pipe(takeUntil(this.destroy$))
      .subscribe(mode => {
        const previousMode = this.currentParallelMode;
        if (previousMode !== mode) {
          logger.debug('Reader received new parallel mode:', mode);
          if (this.isParallelViewActive && this.fluentLangCode) {
            this.updateScrollState();
            if (this.trackProgress) this.progressTracker.startPresentation(`parallel:${this.fluentLangCode}:${mode}`);
          }
          this.currentParallelMode = mode;
          this.cdRef.markForCheck(); // Trigger pipe re-evaluation

          // Schedule height sync specifically when switching TO 'side' mode
          if (mode === 'side') {
            this.scheduleHeightSync();
          }
          // Reset overlay state when switching away from overlay
          if (mode !== 'overlay' && this.currentlyOpenFluentSpan) {
            this.currentlyOpenFluentSpan.hidden = true;
            this.currentlyOpenFluentSpan = null;
          }
        }
      });

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.resetForBook();
      const privateId = params.get('id');
      const slug = params.get('slug');
      if (privateId) this.openPrivateBook(privateId);
      else if (slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) this.openPublicBook(slug);
      else this.handleError("Invalid book reference.");
    });
  }

  private resetForBook(): void {
    this.initialScrollPercentage = null;
    this.initialPosition = null;
    this.initialScrollApplied = false;
    this.isLoading = true;
    this.chapterNav = [];
    this.hasMeasuredChapters = false;
    this.parallelVersions = [];
    this.selectedLookupText = '';
    this.selectedLookupContext = '';
    this.cdRef.markForCheck();
  }

  private openPublicBook(slug: string): void {
    this.bookSlug = slug;
    this.privateBookId = null;
    this.readService.getPublicBook(slug).pipe(takeUntil(this.destroy$)).subscribe({
      next: book => {
        this.bookId = book.id;
        this.targetLangCode = book.language;
        this.parallelVersions = book.languageVariants.filter(variant => variant.language !== book.language);
        this.trackProgress = this.userInfoService.currentUserInfo !== null;
        if (this.trackProgress) {
          this.initialPosition = this.progressTracker.startBook(book.id);
          this.fetchBookData(book.id);
        }
        this.loadBookHtml(slug, true);
      },
      error: error => this.handleError(getErrorMessage(error, 'Could not load book details.')),
    });
  }

  private openPrivateBook(id: string): void {
    if (!isUuid(id)) {
      this.handleError('Invalid private book ID.');
      return;
    }
    this.privateBookId = id;
    this.bookSlug = null;
    this.bookId = id;
    this.trackProgress = false;
    this.readService.getBookImport(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: book => {
        this.targetLangCode = book.language;
        this.loadBookHtml(id, true);
      },
      error: error => this.handleError(getErrorMessage(error, 'Could not load private book.')),
    });
  }

  @HostListener('window:beforeunload')
  unloadNotification(): void {
    this.updateScrollState();
    if (this.trackProgress) this.progressTracker.saveOnExit(true);
  }

  // Schedules the height sync after Angular has rendered changes
  private scheduleHeightSync(): void {
    if (this.currentParallelMode !== 'side' || !this.readerContentRef) {
      logger.debug("Skipping height sync: Not in side mode or content ref missing.");
      return;
    }
    logger.debug("Scheduling height synchronization...");
    // Use setTimeout to queue it after the current rendering cycle
    if (this.heightSyncTimeoutId !== null) {
      clearTimeout(this.heightSyncTimeoutId);
    }
    this.heightSyncTimeoutId = setTimeout(() => {
      this.heightSyncTimeoutId = null;
      this.synchronizeColumnHeights();
    }, 10);
  }

  // Performs PARAGRAPH-BY-PARAGRAPH height measurement and adjustment
  // Performs PARAGRAPH-BY-PARAGRAPH height measurement and adjustment
  // WITHIN each logical section (e.g., chapter) that contains its own columns.
  private synchronizeColumnHeights(): void {
    if (this.isSyncingHeights || this.currentParallelMode !== 'side' || !this.readerContentRef?.nativeElement) {
      return;
    }

    this.isSyncingHeights = true;
    const changesMade = this.readerDom.synchronizeParallelColumns(this.readerContentRef.nativeElement);
    this.isSyncingHeights = false;

    if (changesMade) {
      this.updateScrollState();
      this.scheduleChapterOffsetMeasurement();
      this.cdRef.markForCheck();
    }
  }

  // --- Example method to handle mode-specific logic ---
  protected onContentClick(event: Event): void {
    if (this.currentParallelMode !== 'overlay' || !this.isParallelViewActive) {
      return;
    }
    this.readerDom.toggleOverlayTranslation(this.readerContentRef.nativeElement, event.target);
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
    this.selectedLookupText = text;
    this.selectedLookupContext = sourceElement?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 500) ?? text;
    this.cdRef.markForCheck();
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

  // Specific handler for load errors
  private handleLoadError(loadType: 'base' | 'parallel', message: string): void {
    this.handleError(`Error loading ${loadType} content: ${message}`); // Show error
    this.isLoading = false;
    this.isLoadingParallel = false;
    // Option: Revert to base content if parallel load failed?
    if (loadType === 'parallel') {
      this.revertToBaseContent();
    }
    this.cdRef.markForCheck();
  }

  ngAfterViewInit(): void {
    // Content rendering happens via *ngFor. We measure chapter offsets after rendering.
    this.scheduleChapterOffsetMeasurement();
    // Initial height sync if starting in side mode
    if (this.currentParallelMode === 'side') {
      this.scheduleHeightSync();
    }
    // Also ensure initial scroll state is calculated
    this.updateScrollState();
    this.cdRef.markForCheck();
  }

  ngAfterViewChecked(): void {
    // Try to measure chapters ONLY ONCE after base load
    if (!this.hasMeasuredChapters && !this.isLoading && this.baseBookHtmlContent && !this.isParallelViewActive) {
      logger.debug("ngAfterViewChecked: Attempting ONE-TIME chapter measurement...");
      const measured = this.measureChapterOffsets(); // Try measuring base content
      if (measured) {
        this.hasMeasuredChapters = true; // Mark as done
        logger.debug("ngAfterViewChecked: ONE-TIME chapter measurement successful.");
        this.cdRef.markForCheck(); // Update ToC dropdown
      } else {
        logger.warn("ngAfterViewChecked: ONE-TIME chapter measurement failed. Will retry on next check.");
      }
    }

    // Check if height sync is pending (only for side mode)
    if (this.needsHeightSync && this.currentParallelMode === 'side') {
      // ... (existing height sync logic) ...
      this.synchronizeColumnHeights();
      this.needsHeightSync = false;
    }

    // Always attempt initial scroll
    this.attemptInitialScroll();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.clearScrollHoldTimers();
    this.clearScheduledWork();
    this.baseLoadSubscription?.unsubscribe();
    this.bookDetailsSubscription?.unsubscribe();
    this.parallelLoadSubscription?.unsubscribe();
    this.updateScrollState();
    if (this.trackProgress) this.progressTracker.saveOnExit(false);
    this.destroy$.next();
    this.destroy$.complete();
  }

// Modify loadBookHtml to trigger the scroll AFTER load
  private loadBookHtml(bookId: string, isBase = false): void {
    if (isBase) {
      this.isLoading = true;
      this.isParallelViewActive = false;
      this.hasMeasuredChapters = false; // Allow re-measurement if base is reloaded
      this.chapterNav = []; // Clear nav if base is reloaded
    } else {
      this.isLoadingParallel = true;
    }
    this.errorMessage = null;
    if (isBase) this.baseBookHtmlContent = '';
    this.bookHtmlContent = '';
    if (isBase) this.chapterNav = [];
    this.cdRef.markForCheck();
    this.needsHeightSync = false

    const stream$ = isBase
      ? this.privateBookId
        ? this.readService.loadPrivateBook(bookId)
        : this.readService.loadPublicBook(bookId)
      : this.readService.getPublicParallelText(bookId, this.fluentLangCode!);

    if (isBase) {
      this.baseLoadSubscription?.unsubscribe();
    }
    const subscription = stream$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.status === 200 && response.body) {
          try {
            const fetchedHtml = this.readerDom.decode(response.body);
            this.bookHtmlContent = fetchedHtml;
            if (isBase) {
              this.baseBookHtmlContent = fetchedHtml;
              this.isParallelViewActive = false;
            } else {
              this.isParallelViewActive = true;
            }

            this.isLoading = false;
            this.isLoadingParallel = false;
            this.errorMessage = null;
            logger.debug(`Loaded ${isBase ? 'base' : 'parallel'} HTML content.`);
            this.currentlyOpenFluentSpan = null;
            this.cdRef.markForCheck(); // Ensure view updates with content

            // The reader content is behind an @if while the book is loading, so its
            // ViewChild does not exist during ngAfterViewInit. Measure after this
            // response has caused the base content view to render.
            if (isBase) this.scheduleChapterOffsetMeasurement();

            if (this.currentParallelMode === 'side') {
              this.needsHeightSync = true;
            }
          } catch (e) {
            this.handleLoadError(isBase ? 'base' : 'parallel', `Failed to decode content: ${e instanceof Error ? e.message : String(e)}`);
          }
        } else {
          this.handleLoadError(isBase ? 'base' : 'parallel', `Failed to load content. Status: ${response.status}`);
        }
      },
      error: (error) => this.handleLoadError(isBase ? 'base' : 'parallel', getErrorMessage(error, 'Unknown error loading content.')),
    });
    if (isBase) {
      this.baseLoadSubscription = subscription;
    }
  }

  // attemptInitialScroll checks everything and scrolls if needed
  private attemptInitialScroll(): void {
    // Added check: Don't attempt if component destroyed
    if (this.isDestroyed) {
      return;
    }

    // Conditions: Not loading, target known, not applied yet, wrapper exists
    const hasInitialTarget = this.initialPosition !== null || this.initialScrollPercentage !== null;
    if (!this.isLoading && !this.isLoadingParallel && hasInitialTarget && !this.initialScrollApplied && this.readerContentWrapperRef?.nativeElement) {
      const wrapper = this.readerContentWrapperRef.nativeElement;
      const targetPercentage = this.initialPosition?.percentage ?? this.initialScrollPercentage ?? 0;
      // Add extra check for scrollHeight to ensure layout is likely ready
      const scrollHeight = wrapper.scrollHeight;
      const clientHeight = wrapper.clientHeight;

      if (scrollHeight > 0 && (scrollHeight > clientHeight || targetPercentage === 0)) { // Check scrollHeight > 0 and scroll is possible or target is 0
        if (this.initialPosition && this.readerContentRef?.nativeElement) {
          const targetScrollTop = this.readerDom.scrollTopForPosition(
            wrapper,
            this.readerContentRef.nativeElement,
            this.initialPosition,
          );
          logger.debug(`Restoring precise local reader position at ${targetScrollTop}px.`);
          this.setScrollTop(targetScrollTop);
        } else {
          logger.debug(`Restoring server reader progress at ${targetPercentage}%.`);
          this.scrollToPercentage(targetPercentage);
        }
        this.initialScrollApplied = true; // Mark as applied
        this.updateScrollState();
      } else {
        logger.debug(`Skipped initial scroll attempt: scrollHeight=${scrollHeight}, clientHeight=${clientHeight}, target=${targetPercentage}`);
      }
    } else if (!this.initialScrollApplied && hasInitialTarget) {
      // Log only if we expected to scroll but didn't yet
      // logger.debug(`Skipped initial scroll attempt (in ngAfterViewChecked): isLoading=${this.isLoading}, target=${this.initialScrollPercentage}, applied=${this.initialScrollApplied}, wrapper=${!!this.readerContentWrapperRef?.nativeElement}`);
    }
  }


  // Reverts the view to the base language content
  private revertToBaseContent(): void {
    logger.debug("Reverting to base content.");

    // Check if content or state actually needs reverting
    if (this.bookHtmlContent !== this.baseBookHtmlContent || this.isParallelViewActive || this.fluentLangCode !== null) {
      this.bookHtmlContent = this.baseBookHtmlContent;
      this.isParallelViewActive = false;
      this.currentlyOpenFluentSpan = null;
      this.fluentLangCode = null;
      this.initialPosition = this.trackProgress ? this.progressTracker.startPresentation('base') : null;
      this.initialScrollPercentage = this.initialPosition ? null : this.currentScrollPercentage;

      this.isLoadingParallel = false;
      this.cdRef.markForCheck();

      this.initialScrollApplied = false; // Re-apply the scroll when content changes
      logger.debug("Reverted to base, flags set for ngAfterViewChecked.");
    } else {
      logger.debug("Already in base content state.");
    }
  }

  // Placeholder fetch for parallel languages options
  private fetchBookData(bookId: string): void {
    this.bookDetailsSubscription?.unsubscribe();
    this.bookDetailsSubscription = this.readService.getMiniBookDetailsById(bookId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (book) => {
        if (book) {
          this.targetLangCode = book.language; // <-- ADD THIS LINE
          logger.debug(`%c[Checkpoint 1A] Target Language set:`, 'color: green; font-weight: bold;', this.targetLangCode);
          this.parallelVersions = book.languageVariants.filter(t => t.language !== book.language);
          if (!this.initialPosition) {
            this.initialScrollPercentage = book.progressPercentage ?? 0;
            logger.debug(`Stored server scroll fallback: ${this.initialScrollPercentage}%`);
          }
          this.cdRef.markForCheck();
        }
      },
      error: (error) => logger.error('Error fetching book details for parallel options:', error)
    });
  }

  // General error handler
  private handleError(message: string): void {
    logger.error("Reader Error:", message);
    this.errorMessage = message;
    this.isLoading = false;
    this.chapterNav = [];
    this.currentScrollPercentage = 0;
    this.cdRef.markForCheck();
  }

  // --- Chapter Offset Measurement ---
  // Measures the top offset of rendered chapter elements relative to the scroll container
  // --- Chapter Offset Measurement (Adapted for Direct HTML) ---
  private measureChapterOffsets(): boolean {
    if (this.hasMeasuredChapters || this.isParallelViewActive || !this.baseBookHtmlContent) {
      return this.hasMeasuredChapters;
    }

    const contentElement = this.readerContentRef?.nativeElement;
    if (!contentElement || this.isLoading) return false;

    this.chapterNav = this.readerDom.measureChapters(contentElement, this.targetLangCode);
    return this.chapterNav.length > 0;
  }


  // Schedules chapter measurement reliably after view updates
  private scheduleChapterOffsetMeasurement(): void {
    if (this.chapterMeasurementFrameId !== null) {
      cancelAnimationFrame(this.chapterMeasurementFrameId);
    }
    this.chapterMeasurementFrameId = requestAnimationFrame(() => {
      this.chapterMeasurementFrameId = null;
      if (this.isDestroyed) {
        logger.debug("scheduleChapterOffsetMeasurement: Component destroyed, skipping.");
        return;
      }
      const measurementSuccess = this.measureChapterOffsets();
      if (measurementSuccess) {
        this.updateScrollState(); // Update scroll state based on new measurements
        this.cdRef.markForCheck(); // Update dropdown
      } else {
        logger.warn("scheduleChapterOffsetMeasurement: Measurement failed or refs not ready.");
      }
    });
  }

  // --- Event Listeners Setup ---
  // Handles window resize to remeasure chapter offsets
  private setupResizeListener(): void {
    this.resizeSubject.pipe(
      debounceTime(this.RESIZE_DEBOUNCE_TIME),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      logger.debug('Window resized...');
      this.scheduleChapterOffsetMeasurement(); // Keep chapter remeasurement
      // Also re-sync heights if in side-by-side mode
      if (this.currentParallelMode === 'side') {
        this.scheduleHeightSync();
      }
      this.updateScrollState(); // Update scroll percentage after potential layout changes
      this.cdRef.markForCheck();
    });
  }

  // Handles slider input to scroll the content
  private setupSliderListener(): void {
    this.sliderValueSubject.pipe(
      debounceTime(this.SLIDER_DEBOUNCE_TIME),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(percentage => {
      logger.debug(`Slider target percentage: ${percentage}`);
      this.scrollToPercentage(percentage);
    });
  }

  // Handles native scroll events to update the slider/percentage display
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


  // Called by the (scroll) event binding on the wrapper
  protected onWrapperScroll(event: Event): void {
    // Use NgZone.runOutsideAngular to prevent excessive change detection cycles during rapid scroll events
    this.ngZone.runOutsideAngular(() => {
      this.scrollEvent$.next(event);
    });
  }

  // Calculates and updates the current scroll percentage state
  private updateScrollState(): void {
    if (!this.readerContentWrapperRef) return;
    const state = this.readerDom.getScrollState(this.readerContentWrapperRef.nativeElement);
    this.isAtScrollTop = state.isAtTop;
    this.isAtScrollBottom = state.isAtBottom;

    if (state.percentage !== this.currentScrollPercentage) {
      this.currentScrollPercentage = state.percentage;
    }

    if (this.trackProgress && this.initialScrollApplied && this.readerContentRef?.nativeElement) {
      const position = this.readerDom.capturePosition(
        this.readerContentWrapperRef.nativeElement,
        this.readerContentRef.nativeElement,
      );
      this.progressTracker.update(state.percentage, position);
    }
  }

// Keep the guards in scrollToPercentage
  private scrollToPercentage(percentage: number): void {
    if (!this.readerContentWrapperRef?.nativeElement) return;
    const element = this.readerContentWrapperRef.nativeElement;
    const targetScrollTop = this.readerDom.scrollTopForPercentage(element, percentage);
    if (targetScrollTop !== null) this.setScrollTop(targetScrollTop);
  }

  // Centralized method to set scrollTop and manage the programmatic scroll flag
  private setScrollTop(value: number): void {
    if (!this.readerContentWrapperRef) return;
    const element = this.readerContentWrapperRef.nativeElement;

    const clampedValue = this.readerDom.clampScrollTop(element, value);

    // Only scroll if the value is actually different
    if (Math.round(element.scrollTop) === Math.round(clampedValue)) {
      return;
    }

    this.isScrollingProgrammatically = true;
    element.scrollTop = clampedValue;

    // Update percentage immediately after programmatic scroll
    // Run this inside NgZone if update needs to trigger immediate UI update
    this.ngZone.run(() => {
      this.updateScrollState(); // Call updated function
      this.cdRef.markForCheck();
    });

    // Reset the flag shortly after, outside Angular zone
    this.ngZone.runOutsideAngular(() => {
      if (this.scrollFlagTimeoutId !== null) {
        clearTimeout(this.scrollFlagTimeoutId);
      }
      this.scrollFlagTimeoutId = setTimeout(() => {
        this.scrollFlagTimeoutId = null;
        this.isScrollingProgrammatically = false;
      }, this.SCROLL_UPDATE_THROTTLE_TIME + 50); // Delay slightly longer than throttle time
    });
  }

  // Called by slider's (input) event
  protected onSliderInput(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    // Update display immediately for perceived responsiveness
    this.currentScrollPercentage = value;
    // Let debounced handler actually perform the scroll
    this.sliderValueSubject.next(value);
  }


  // --- Navigation ---
  // Scrolls down by approximately one viewport height
  protected nextPage(): void {
    if (!this.readerContentWrapperRef) return;
    const element = this.readerContentWrapperRef.nativeElement;
    // Use 90% of clientHeight for a slight overlap effect if desired
    const scrollAmount = element.clientHeight * 0.95;
    this.setScrollTop(element.scrollTop + scrollAmount);
  }

  // Scrolls up by approximately one viewport height
  protected prevPage(): void {
    if (!this.readerContentWrapperRef) return;
    const element = this.readerContentWrapperRef.nativeElement;
    const scrollAmount = element.clientHeight * 0.95;
    this.setScrollTop(element.scrollTop - scrollAmount);
  }

  // Scrolls by a small fixed pixel amount (for hold/keys)
  private performScrollStep(direction: 'prev' | 'next'): void {
    if (!this.readerContentWrapperRef) return;
    const element = this.readerContentWrapperRef.nativeElement;
    let newScrollTop = element.scrollTop;

    if (direction === 'prev') {
      newScrollTop -= this.SCROLL_STEP_PX;
    } else { // direction === 'next'
      newScrollTop += this.SCROLL_STEP_PX;
    }
    this.setScrollTop(newScrollTop); // setScrollTop handles clamping
  }

  // --- Touch & Hold Scroll ---
  // Flag start/end of touch interaction
  protected onTouchStart(): void {
    this.isTouching = true;
    this.clearScrollHoldTimers(); // Prevent hold scroll if touch interaction starts
  }

  protected onTouchMove(): void { /* Browser handles native scroll */
  }

  protected onTouchEnd(): void {
    this.isTouching = false;
  }

  protected onTouchCancel(): void {
    this.isTouching = false;
  }

  // Clears timers for hold-scrolling
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

  // Initiates hold-to-scroll behavior
  protected startScrollHold(direction: 'prev' | 'next'): void {
    if (this.isTouching) return; // Don't start if user is touching the screen
    this.clearScrollHoldTimers();
    this.isHoldingForScroll = false; // Reset flag

    this.scrollHoldTimeoutId = setTimeout(() => {
      this.isHoldingForScroll = true;
      this.scrollIntervalId = setInterval(() => {
        // Double-check if touch started during the interval
        if (this.isTouching) {
          this.clearScrollHoldTimers();
          return;
        }
        this.performScrollStep(direction);
      }, this.SCROLL_INTERVAL_DELAY);
    }, this.SCROLL_HOLD_DELAY);
  }

  // Stops hold-to-scroll and handles click vs. hold release
  protected stopScrollHold(triggerAction: 'prev' | 'next'): void {
    const wasHoldScrollActive = this.isHoldingForScroll;
    this.clearScrollHoldTimers(); // Always clear timers

    // If it wasn't a hold scroll that activated, AND not currently touching
    if (!wasHoldScrollActive && !this.isTouching) {
      logger.debug("Performing single page action on click/release.");
      if (triggerAction === 'prev') this.prevPage();
      else this.nextPage();
    } else if (wasHoldScrollActive) {
      logger.debug("Hold scroll stopped.");
    }
    // isHoldingForScroll is reset in clearScrollHoldTimers
  }

  // --- Keyboard Nav ---
  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (this.isLoading) return;
    const target = event.target as HTMLElement;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target?.tagName?.toUpperCase())) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return; // Ignore modified keys

    let handled = false;
    switch (event.key) {
      case 'ArrowLeft':
      case 'PageUp':
        this.prevPage();
        handled = true;
        break;
      case 'ArrowRight':
      case 'PageDown':
      case ' ': // Space bar
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
    }
    if (handled) {
      event.preventDefault(); // Prevent default browser action (like scrolling page)
    }
  }

  // --- Whitespace Click ---
  // Handles clicks in the empty areas around the content
  protected onWrapperClick(event: MouseEvent): void {
    if (!this.readerContentRef || !this.paginationControlsRef || !this.readerContentWrapperRef) return;
    const targetNode = event.target as Node;
    // Ignore clicks on controls or inside the actual rendered content elements
    if (this.paginationControlsRef.nativeElement.contains(targetNode) ||
      this.readerContentRef.nativeElement.contains(targetNode)) {
      return;
    }
    // Click was in the wrapper but outside content/controls
    const wrapperRect = this.readerContentWrapperRef.nativeElement.getBoundingClientRect();
    if (event.clientX > wrapperRect.left + wrapperRect.width / 2) {
      this.nextPage();
    } else {
      this.prevPage();
    }
  }

  protected onContentHover(event: Event): void {
    const content = this.readerContentRef?.nativeElement;
    if (!content || this.currentParallelMode !== 'side') return;
    const segment = event.target instanceof Element ? event.target.closest<HTMLElement>('.sbs-segment') : null;
    content.querySelectorAll('.sbs-segment.is-current').forEach(item => item.classList.remove('is-current'));
    const pair = segment?.dataset['pair'];
    if (!pair || !/^\d+$/.test(pair)) return;
    content.querySelectorAll<HTMLElement>(`.sbs-segment[data-pair="${pair}"]`).forEach(item => item.classList.add('is-current'));
  }

  @HostListener('document:click', ['$event'])
  protected closeChapterNavigation(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Node && this.tocTrigger?.nativeElement.contains(target)) return;
    this.chapterNavigationDropdown?.toggle(false);
  }

  protected toggleChapterNavigation(dropdown: TuiDropdownDirective): void {
    this.chapterNavigationDropdown = dropdown;
    dropdown.toggle(!dropdown.ref());
  }

  // --- Chapter Navigation ---
  // Scrolls to the measured offsetTop of a selected chapter
  protected jumpToChapter(chapterIndex: number): void { // Parameter is index
    if (this.isLoading || !this.readerContentWrapperRef || chapterIndex < 0 || chapterIndex >= this.chapterNav.length) {
      logger.warn(`Cannot jump: Invalid chapter index ${chapterIndex} or prerequisites not met.`);
      return;
    }

    const contentElement = this.readerContentRef?.nativeElement;
    if (!contentElement) {
      logger.warn(`Cannot jump: contentElement not available.`);
      return;
    }

    // 1. Get the stored info, including the unique elementId ('chapX')
    const targetChapterInfo = this.chapterNav[chapterIndex];
    if (!targetChapterInfo?.elementId) {
      logger.warn(`Cannot jump: Chapter info or elementId missing for index ${chapterIndex}.`);
      return;
    }

    logger.debug(`Jumping to chapter index: ${chapterIndex} (Title: ${targetChapterInfo.title}, ID: ${targetChapterInfo.elementId})`); // Log the ID

    const elementToScrollTo = this.readerDom.findChapter(contentElement, targetChapterInfo.elementId);

    // Perform the scroll if element found
    if (elementToScrollTo) {
      logger.debug(`Scrolling to element for index ${chapterIndex} (ID: ${targetChapterInfo.elementId}):`, elementToScrollTo);
      elementToScrollTo.scrollIntoView({behavior: 'smooth', block: 'start'});
      // Update percentage after scroll finishes
      if (this.chapterScrollTimeoutId !== null) {
        clearTimeout(this.chapterScrollTimeoutId);
      }
      this.chapterScrollTimeoutId = setTimeout(() => {
        this.chapterScrollTimeoutId = null;
        if (!this.isDestroyed) {
          this.updateScrollState();
          this.cdRef.markForCheck();
        }
      }, 350); // Increased timeout slightly just in case
    } else {
      logger.warn(`Cannot jump: Final check failed, elementToScrollTo is null for ID ${targetChapterInfo.elementId}.`);
    }
  }

// Modify selectChapter to pass the INDEX
  protected selectChapter(chapterIndex: number): void { // Parameter is now index
    logger.debug("Chapter selected by index:", chapterIndex);
    if (chapterIndex !== null && chapterIndex >= 0) {
      this.jumpToChapter(chapterIndex);
    } else {
      logger.warn("Invalid index received from chapter selection:", chapterIndex);
    }
  }

  // Getter for parallel language options used in template
  get langs() {
    return this.parallelVersions.map(t => t.language);
  }

  get availableLangs(): string[] {
    logger.debug('Recalculating availableLangs'); // Add this to see how often it runs
    return this.langs.filter(l => l !== this.fluentLangCode);
  }

  private parallelLoadSubscription: Subscription | null = null;

  private clearScheduledWork(): void {
    if (this.heightSyncTimeoutId !== null) {
      clearTimeout(this.heightSyncTimeoutId);
      this.heightSyncTimeoutId = null;
    }
    if (this.scrollFlagTimeoutId !== null) {
      clearTimeout(this.scrollFlagTimeoutId);
      this.scrollFlagTimeoutId = null;
    }
    if (this.chapterScrollTimeoutId !== null) {
      clearTimeout(this.chapterScrollTimeoutId);
      this.chapterScrollTimeoutId = null;
    }
    if (this.chapterMeasurementFrameId !== null) {
      cancelAnimationFrame(this.chapterMeasurementFrameId);
      this.chapterMeasurementFrameId = null;
    }
  }

  selectOption(langCode: string | null): void { // Allow null if you add a way to deselect
    logger.debug(`%c[Checkpoint 1B] Fluent Language selected:`, 'color: green; font-weight: bold;', langCode);

    if (langCode !== null && langCode === this.fluentLangCode) {
      logger.debug(`Language ${langCode} is already selected.`);
      // Optionally close the dropdown here if needed, depending on your template structure
      return; // Exit early
    }

    // --- 1. Cancel Previous Request ---
    this.parallelLoadSubscription?.unsubscribe();

    this.fluentLangCode = langCode;

    // --- 2. Handle Selection ---
    if (langCode && this.bookSlug) {
      // --- 2a. Start Loading Process ---

      // Perform pre-fetch UI updates (from original 'tap')
      if (this.currentlyOpenFluentSpan) {
        this.currentlyOpenFluentSpan.hidden = true;
        this.currentlyOpenFluentSpan = null;
      }
      this.isParallelViewActive = false; // Tentatively set false
      this.isLoadingParallel = true;    // Show loader
      this.errorMessage = null;         // Clear previous errors
      this.cdRef.markForCheck();        // Update UI

      // Initiate the network call (from original 'switchMap')
      this.parallelLoadSubscription = this.readService.getPublicParallelText(this.bookSlug, langCode).pipe(
        takeUntil(this.destroy$), // Auto-unsubscribe on component destroy
        finalize(() => {
          // Runs on completion, error, or unsubscribe
          this.isLoadingParallel = false; // ALWAYS hide loader eventually
          this.cdRef.markForCheck();
        }),
        catchError(error => {
          // Handle error within the stream (from original 'catchError')
          this.handleLoadError('parallel', getErrorMessage(error, 'Unknown error fetching parallel content.'));
          this.revertToBaseContent(); // Revert UI on error
          return EMPTY; // Prevent observable from completing incorrectly
        })
      ).subscribe({
        next: (response) => {
          // Handle successful response (from original 'subscribe.next')
          if (response.status === 200 && response.body) {
            try {
              // Decode and update content
              this.bookHtmlContent = this.readerDom.decode(response.body);
              this.isParallelViewActive = true;   // Now parallel view is active
              this.errorMessage = null;         // Clear previous errors
              logger.debug(`Loaded parallel HTML content for ${langCode}.`);
              this.initialPosition = this.trackProgress
                ? this.progressTracker.startPresentation(`parallel:${langCode}:${this.currentParallelMode}`)
                : null;
              // Trigger layout updates and scrolling
              // *** Schedule height sync AFTER parallel content is loaded AND if in side mode ***
              // Note: Pipe re-runs automatically due to cdRef.markForCheck()
              if (this.currentParallelMode === 'side') {
                this.needsHeightSync = true;
              }
              logger.debug("Parallel content loaded, flags set for ngAfterViewChecked.");
              // Resume this exact presentation when it has been used before.
              this.initialScrollPercentage = this.initialPosition ? null : 0;
              this.initialScrollApplied = false; // Ensure ngAfterViewChecked applies it
            } catch (e) {
              // Handle decoding error
              this.handleLoadError('parallel', `Failed to decode parallel content: ${e instanceof Error ? e.message : String(e)}`);
              this.revertToBaseContent(); // Revert UI on decoding error
            }
          } else {
            // Handle non-200 success status
            this.handleLoadError('parallel', `Failed to load parallel content. Status: ${response.status}`);
            this.revertToBaseContent(); // Revert UI on load failure
          }
          // isLoadingParallel is handled by finalize
          this.cdRef.markForCheck(); // Ensure UI reflects changes
        },
        // Error handler in subscribe is less likely due to catchError, but good practice
        error: (err) => {
          logger.error("Unexpected error in parallel load subscription:", err);
          this.handleLoadError('parallel', 'An unexpected error occurred during parallel load.');
          this.revertToBaseContent(); // Revert UI on unexpected error
          // isLoadingParallel is handled by finalize
          this.cdRef.markForCheck();
        }
      });

    } else {
      // --- 2b. Language Deselected or Missing bookId: Revert to Base ---
      logger.debug("Reverting to base content (no valid language selected or missing bookId).");
      this.revertToBaseContent();
      // Ensure loader is off if we bail out early
      if (this.isLoadingParallel) {
        this.isLoadingParallel = false;
        this.cdRef.markForCheck();
      }
    }
  }

  @ViewChild(ParallelSettingsComponent, {static: true}) parallelSettingsComponent!: ParallelSettingsComponent;

  openParallelSettings() {
    this.popupTemplateStateService.open(this.parallelSettingsComponent.content, 'avatar');
  }
}
