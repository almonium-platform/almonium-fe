import {
  AfterViewChecked,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  Pipe,
  PipeTransform,
  ViewChild
} from '@angular/core';
import {ReadService} from '../read.service';
import {CommonModule, SlicePipe} from '@angular/common';
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {EMPTY, filter, finalize, Subject, Subscription} from 'rxjs';
import {catchError, debounceTime, distinctUntilChanged, switchMap, takeUntil, tap, throttleTime} from 'rxjs/operators';
import {SharedLucideIconsModule} from "../../../shared/shared-lucide-icons.module";
import {ButtonComponent} from "../../../shared/button/button.component";
import {TuiDataListDropdownManager, TuiSliderComponent} from "@taiga-ui/kit";
import {ActivatedRoute} from "@angular/router";
import {BookLanguageVariant} from "../book.model";
import {TuiActiveZone} from "@taiga-ui/cdk";
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";
import {ParallelFormatPipe} from "./parallel-format.pipe";
import {LoadingIndicatorComponent} from "../../../shared/loading-indicator/loading-indicator.component";
import {ParallelTranslationComponent} from "../parallel-translation/parallel-translation.component";
import {PopupTemplateStateService} from "../../../shared/modals/popup-template/popup-template-state.service";
import {ParallelSettingsComponent} from "../../../parallel-settings/parallel-settings.component";
import {DEFAULT_PARALLEL_MODE, ParallelMode} from '../parallel-mode.type';
import {ParallelModeService} from "../parallel-mode.service";
import {TuiDataList, TuiDropdownDirective, TuiOptGroup} from "@taiga-ui/core";

interface BlockData {
  type: 'paragraph' | 'verse' | 'chapter';
  content: string; // The text content, potentially with <em>/<strong>
  originalIndex: number; // Use for unique IDs
}

interface ChapterNavInfo {
  title: string;     // Always English Title
  offsetTop: number; // Initial offset from base content (might become slightly inaccurate after height sync)
  elementId: string; // Original anchor ID (chapX) - keep for reference if needed
  index: number;     // The 0-based index of this chapter in the list
}

@Pipe({name: 'safeHtml', standalone: true})
export class SafeHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {
  }

  transform(value: string | null | undefined): SafeHtml | null {
    if (value === null || value === undefined) return null;
    // Trust the HTML source from Gutenberg (assuming it's safe)
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}

@Component({
  selector: 'app-reader',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SharedLucideIconsModule,
    ButtonComponent,
    TuiSliderComponent,
    SlicePipe,
    TuiActiveZone,
    SafeHtmlPipe,
    ParallelFormatPipe,
    LoadingIndicatorComponent,
    ParallelTranslationComponent,
    TuiDataListDropdownManager,
    ParallelSettingsComponent,
    ParallelFormatPipe,
    ParallelFormatPipe,
    ParallelFormatPipe,
    TuiDropdownDirective,
    TuiOptGroup,
    TuiDataList,
  ],
  templateUrl: './reader.component.html',
  styleUrls: ['./reader.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReaderComponent implements OnInit, AfterViewInit, OnDestroy, AfterViewChecked {
  // --- Element References ---
  @ViewChild('readerContainer') readerContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('readerContentWrapper') readerContentWrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('readerContent') readerContentRef!: ElementRef<HTMLDivElement>;
  @ViewChild('paginationControls') paginationControlsRef!: ElementRef<HTMLDivElement>;

  // --- State Properties ---
  private processedContent: string = '';    // Raw text from backend
  protected blocks: BlockData[] = [];       // Parsed blocks for rendering
  protected chapterNav: ChapterNavInfo[] = []; // Store chapter offsets for navigation
  private hasMeasuredChapters: boolean = false; // Flag to ensure we measure only once

  protected bookHtmlContent: string = ''; // Store the raw HTML from backend
  protected baseBookHtmlContent: string = ''; // Store the raw HTML from backend

  protected isLoading: boolean = true;          // General loading state
  protected isLoadingParallel: boolean = false; // Specific loading state for parallel text
  protected errorMessage: string | null = null;
  protected bookId: number | null = null;
  protected currentBaseLanguage: string = 'EN'; // Assume base is EN, adjust if needed

  // --- Native Scroll State ---
  protected currentScrollPercentage: number = 0; // Current scroll position (0-100)
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
  private isHoldingForScroll: boolean = false;
  private readonly SCROLL_HOLD_DELAY = 350;
  private readonly SCROLL_INTERVAL_DELAY = 50;

  // --- Parallel Text (Placeholder State) ---
  protected parallelVersions: BookLanguageVariant[] = [];
  protected languageSelectControl = new FormControl<string | null>(null);
  protected isParallelViewActive: boolean = false; // Still needed to know *if* content has translations
  private currentlyOpenUkrSpan: HTMLElement | null = null;

  protected isAtScrollTop: boolean = true; // ADDED: True initially
  protected isAtScrollBottom: boolean = false; // ADDED: False initially

  protected currentParallelMode: ParallelMode = DEFAULT_PARALLEL_MODE;
  protected selectedLangCode: string | null = null;
  private isSyncingHeights = false;

  private progressUpdate$ = new Subject<number>();
  private lastSavedPercentage: number = -1; // Track last saved value
  private readonly SAVE_DEBOUNCE_TIME = 750; // Wait ms after scrolling stops
  private readonly SAVE_THROTTLE_TIME = 10000; // Save at most every 30s
  private initialScrollPercentage: number | null = null;
  private initialScrollApplied: boolean = false;
  private isDestroyed = false;

  private needsHeightSync: boolean = false;
  protected mode: 'side' | 'overlay' | 'inline' = 'inline'; // Default to side-by-side

  constructor(
    private cdRef: ChangeDetectorRef,
    private readService: ReadService,
    private route: ActivatedRoute,
    private ngZone: NgZone,
    private parallelModeService: ParallelModeService,
    private popupTemplateStateService: PopupTemplateStateService,
  ) {
  }

  // --- Lifecycle Hooks ---

  ngOnInit(): void {
    this.setupResizeListener();
    this.setupSliderListener();
    this.setupScrollListener();
    this.setupProgressSaving();
    this.parallelModeService.mode$
      .pipe(takeUntil(this.destroy$))
      .subscribe(mode => {
        const previousMode = this.currentParallelMode;
        if (previousMode !== mode) {
          console.log('Reader received new parallel mode:', mode);
          this.currentParallelMode = mode;
          this.cdRef.markForCheck(); // Trigger pipe re-evaluation

          // Schedule height sync specifically when switching TO 'side' mode
          if (mode === 'side') {
            this.scheduleHeightSync();
          }
          // Reset overlay state when switching away from overlay
          if (mode !== 'overlay' && this.currentlyOpenUkrSpan) {
            this.currentlyOpenUkrSpan.hidden = true;
            this.currentlyOpenUkrSpan = null;
          }
        }
      });

    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const bookId = params['id'];
      this.bookId = bookId ? +bookId : null;
      if (this.bookId) {
        // Reset state for new book load
        this.initialScrollPercentage = null; // Reset scroll target
        this.lastSavedPercentage = -1;    // Reset last saved progress
        this.initialScrollApplied = false; // Reset flag for initial scroll
        this.isLoading = true; // Ensure loading starts true
        this.chapterNav = [];
        this.hasMeasuredChapters = false;
        this.cdRef.markForCheck(); // Update view for loader

        // Fetch metadata FIRST (or parallel is fine, just store the value)
        this.fetchBookData(this.bookId);

        // Load the actual book content
        this.loadBookHtml(this.bookId, true);

        // Setup listener for language selection changes AFTER initial load might start
        this.setupLanguageSelectionListener();
      } else {
        this.handleError("Invalid Book ID.");
      }
    });
  }

  private setupProgressSaving(): void {
    this.progressUpdate$.pipe(
      // 1. Debounce: Only react when scrolling might have paused
      debounceTime(this.SAVE_DEBOUNCE_TIME),
      // 2. Distinct: Only save if the rounded percentage actually changed since last emission
      distinctUntilChanged(),
      // 3. Filter: Don't save if essential info is missing
      filter(() => !!this.bookId),
      // 4. Throttle: Limit saves during periods of frequent stopping/starting
      //    leading: false - don't save immediately on first event after throttle window opens
      //    trailing: true - ensure the *last* debounced value in a burst gets saved after throttle time
      throttleTime(this.SAVE_THROTTLE_TIME, undefined, {leading: false, trailing: true}),
      takeUntil(this.destroy$) // Unsubscribe on component destroy
    ).subscribe(percentage => {
      // Check if it's different from the very last *saved* value
      if (percentage !== this.lastSavedPercentage) {
        console.log(`Throttled save triggered for percentage: ${percentage}`);
        // Use switchMap if you want to cancel previous pending saves, though less critical with throttling
        this.readService.saveProgress(this.bookId!, percentage)
          .subscribe(() => {
            this.lastSavedPercentage = percentage; // Update last saved value on success
          });
      } else {
        console.log(`Skipping throttled save, percentage ${percentage} hasn't changed since last save.`);
      }
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: BeforeUnloadEvent): void {
    this.saveProgressOnExit(true); // Attempt beacon save
  }

  // Schedules the height sync after Angular has rendered changes
  private scheduleHeightSync(): void {
    if (this.currentParallelMode !== 'side' || !this.readerContentRef) {
      console.log("Skipping height sync: Not in side mode or content ref missing.");
      return;
    }
    console.log("Scheduling height synchronization...");
    // Use setTimeout to queue it after the current rendering cycle
    setTimeout(() => {
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
    console.log("Synchronizing PARAGRAPH heights within columns, section by section...");
    const contentElement = this.readerContentRef.nativeElement;

    // --- Step 1: Identify the wrapper elements that contain ONE pair of columns ---
    // Assuming your pipe wraps each chapter in a <div class="chapter"> (or similar)
    // Adjust '.chapter' selector if your pipe uses a different wrapper class/tag.
    const sectionWrappers = contentElement.querySelectorAll<HTMLElement>('.chapter'); // <-- ADJUST SELECTOR if needed

    if (!sectionWrappers || sectionWrappers.length === 0) {
      console.warn("Height Sync: Could not find any section wrappers (e.g., '.chapter'). Falling back to old method (might be incorrect).");
      // Optional: Add fallback to old logic here if needed, but it's likely flawed.
      // this.synchronizeSingleColumnPair(contentElement); // Example fallback
      this.isSyncingHeights = false;
      return;
    }

    let overallChangesMade = false;
    console.log(`Found ${sectionWrappers.length} potential sections to synchronize.`);

    // --- Step 2: Iterate through each section wrapper ---
    sectionWrappers.forEach((wrapper, index) => {
      // console.log(`Processing section ${index + 1}...`);

      // --- Step 3: Find the columns WITHIN THIS SPECIFIC wrapper ---
      const engCol = wrapper.querySelector<HTMLDivElement>('.sbs-eng-column');
      const ukrCol = wrapper.querySelector<HTMLDivElement>('.sbs-ukr-column');

      if (!engCol || !ukrCol) {
        // console.warn(`  Section ${index + 1}: Could not find both ENG and UKR columns. Skipping this section.`);
        return; // Skip this section wrapper
      }

      // --- Step 4: Find blocks (p, h2) WITHIN THESE SPECIFIC columns ---
      const engBlocks = Array.from(engCol.querySelectorAll<HTMLElement>('p, h2')); // Select p AND h2
      const ukrBlocks = Array.from(ukrCol.querySelectorAll<HTMLElement>('p, h2'));

      // Check if counts match for THIS section
      if (engBlocks.length !== ukrBlocks.length) {
        console.warn(`  Section ${index + 1}: Mismatch in block count (${engBlocks.length} vs ${ukrBlocks.length}). Alignment might be incorrect for this section.`);
      }

      let sectionChangesMade = false;
      const numBlocksToAlign = Math.min(engBlocks.length, ukrBlocks.length);
      // console.log(`  Section ${index + 1}: Aligning ${numBlocksToAlign} block pairs.`);

      // --- Step 5: Synchronize heights for blocks in THIS section ---
      for (let i = 0; i < numBlocksToAlign; i++) {
        const engP = engBlocks[i];
        const ukrP = ukrBlocks[i];

        // Reset heights first
        engP.style.minHeight = '';
        ukrP.style.minHeight = '';
        // Consider resetting margin if it interferes
        // engP.style.marginBottom = '';
        // ukrP.style.marginBottom = '';

        // Force reflow (offsetHeight does this implicitly)
        const engHeight = engP.offsetHeight;
        const ukrHeight = ukrP.offsetHeight;
        const maxHeight = Math.max(engHeight, ukrHeight);

        // console.log(`    Block Pair ${i + 1} (<${engP.tagName}>): EngH=${engHeight}, UkrH=${ukrHeight}, MaxH=${maxHeight}`);

        // Apply the max height if different (use a small tolerance)
        const tolerance = 1; // pixels
        if (Math.abs(engHeight - maxHeight) > tolerance) {
          engP.style.minHeight = `${maxHeight}px`;
          sectionChangesMade = true;
        }
        if (Math.abs(ukrHeight - maxHeight) > tolerance) {
          ukrP.style.minHeight = `${maxHeight}px`;
          sectionChangesMade = true;
        }
        // Optional: Ensure consistent bottom margin if needed
        // engP.style.marginBottom = '1em'; // Example
        // ukrP.style.marginBottom = '1em'; // Example
      }

      if (sectionChangesMade) {
        overallChangesMade = true;
      }
    }); // End loop through sectionWrappers

    console.log(`Section-by-section height synchronization complete. Overall changes applied: ${overallChangesMade}`);
    this.isSyncingHeights = false;

    // Trigger Angular updates if needed
    if (overallChangesMade) {
      // Use ngZone run if updates happen outside Angular's direct knowledge often
      // this.ngZone.run(() => {
      this.updateScrollState(); // Essential after height changes
      this.scheduleChapterOffsetMeasurement(); // Recalculate chapter offsets
      this.cdRef.markForCheck(); // Let Angular know things changed
      // });
    }
  }

  // --- Example method to handle mode-specific logic ---

  protected onContentClick(event: MouseEvent): void {
    if (this.currentParallelMode !== 'overlay' || !this.isParallelViewActive) return;

    const target = event.target as HTMLElement;
    const engSpan = target.closest('span.eng'); // Find the clicked English span

    if (engSpan) {
      const segPair = engSpan.closest('span.seg-pair'); // Find its parent pair container
      if (segPair) {
        const ukrSpan = segPair.querySelector('span.ukr') as HTMLElement | null; // Find the corresponding Ukrainian span

        if (ukrSpan) {
          // --- Logic to close previously open span ---
          // Check if the clicked span is DIFFERENT from the currently open one
          if (this.currentlyOpenUkrSpan && this.currentlyOpenUkrSpan !== ukrSpan) {
            console.log("Closing previously open translation.");
            this.currentlyOpenUkrSpan.hidden = true; // Hide the previous one
            // If using class toggling: this.currentlyOpenUkrSpan.closest('span.seg-pair')?.classList.remove('show-translation');
            this.currentlyOpenUkrSpan = null; // Reset the reference
          }

          // --- Toggle the clicked span ---
          const isNowHidden = !ukrSpan.hidden; // State *after* toggling
          ukrSpan.hidden = isNowHidden;
          // If using class toggling: segPair.classList.toggle('show-translation', !isNowHidden);

          // --- Update the reference ---
          if (!isNowHidden) {
            // If it was just made visible, store its reference
            this.currentlyOpenUkrSpan = ukrSpan;
            console.log(`Opened translation for: ${engSpan.textContent?.trim()}`);
          } else {
            // If it was just hidden (by clicking itself again), clear the reference
            this.currentlyOpenUkrSpan = null;
            console.log(`Closed translation for: ${engSpan.textContent?.trim()}`);
          }
        }
      }
    } else {
      // --- Clicked *outside* any engSpan ---
      // Close the currently open span, if any
      if (this.currentlyOpenUkrSpan) {
        console.log("Clicked outside, closing open translation.");
        this.currentlyOpenUkrSpan.hidden = true;
        // If using class toggling: this.currentlyOpenUkrSpan.closest('span.seg-pair')?.classList.remove('show-translation');
        this.currentlyOpenUkrSpan = null;
      }
    }
  }

// --- Language Selection Listener ---
  private setupLanguageSelectionListener(): void {
    this.languageSelectControl.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged(), // Compare previous selection if needed
        tap(langCode => {
            console.log("Language selected:", langCode);
            // Fetch the parallel content
            if (this.currentlyOpenUkrSpan) {
              this.currentlyOpenUkrSpan.hidden = true;
              this.currentlyOpenUkrSpan = null;
            }
            this.isParallelViewActive = false; // Tentatively set false
            if (langCode) this.isLoadingParallel = true; // Show loader only if selecting a lang
            this.cdRef.markForCheck();
          }
        ),
        // Use switchMap to automatically cancel previous load request if user selects quickly
        switchMap(langCode => {
          if (langCode && this.bookId) {
            this.isLoadingParallel = true; // Show parallel loading indicator
            this.isParallelViewActive = false; // Tentatively set false until loaded
            this.cdRef.markForCheck();

            return this.readService.getParallelText(this.bookId, langCode).pipe(
              catchError(error => {
                // Handle error within the stream
                this.handleLoadError('parallel', error?.error?.message || 'Unknown error fetching parallel content.');
                return EMPTY; // Prevent observable from completing on error
              })
            );
          } else {
            // Language deselected (or null initially), revert to base
            this.revertToBaseContent();
            return EMPTY; // Don't proceed with network call
          }
        })
      )
      .subscribe({
        next: (response) => {
          // Handle successful response from getParallelText
          if (response.status === 200 && response.body) {
            try {
              this.bookHtmlContent = this.arrayBufferToString(response.body); // Store in current display
              this.isParallelViewActive = true;   // Now parallel view is active
              this.isLoadingParallel = false;
              this.errorMessage = null;         // Clear previous errors
              console.log(`Loaded parallel HTML content for ${this.languageSelectControl.value}.`);
              this.cdRef.markForCheck();
              this.scheduleChapterOffsetMeasurement(); // Remeasure layout
              this.scrollToPercentage(0); // Scroll to top
            } catch (e) {
              this.handleLoadError('parallel', `Failed to decode parallel content: ${e instanceof Error ? e.message : String(e)}`);
            }
          } else {
            this.handleLoadError('parallel', `Failed to load parallel content. Status: ${response.status}`);
          }
        }
      });
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
      console.log("ngAfterViewChecked: Attempting ONE-TIME chapter measurement...");
      const measured = this.measureChapterOffsets(); // Try measuring base content
      if (measured) {
        this.hasMeasuredChapters = true; // Mark as done
        console.log("ngAfterViewChecked: ONE-TIME chapter measurement successful.");
        this.cdRef.markForCheck(); // Update ToC dropdown
      } else {
        console.warn("ngAfterViewChecked: ONE-TIME chapter measurement failed. Will retry on next check.");
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
    this.parallelLoadSubscription?.unsubscribe();
    this.saveProgressOnExit(false); // Attempt regular save
    this.destroy$.next();
    this.destroy$.complete();
  }

  private saveProgressOnExit(useBeacon: boolean): void {
    console.log(`Attempting save on exit (useBeacon: ${useBeacon})`);
    if (this.bookId && this.currentScrollPercentage !== this.lastSavedPercentage) {
      const book = this.bookId;
      const percentage = this.currentScrollPercentage;

      if (useBeacon) {
        // Try Beacon API first for ungraceful exit
        const success = this.readService.sendProgressBeacon(book, percentage);
        if (success) {
          this.lastSavedPercentage = percentage; // Assume success if beacon sends
        } else {
          // Beacon failed or not supported - maybe a quick sync localStorage save as fallback?
          console.warn("Beacon save failed/unsupported during unload.");
          // localStorage.setItem(`reading_progress_${book}`, percentage.toString());
        }
      } else {
        // Regular HTTP call for graceful exit (ngOnDestroy)
        this.readService.saveProgress(book, percentage)
          .subscribe(() => {
            this.lastSavedPercentage = percentage;
            console.log("Saved progress during ngOnDestroy");
          });
      }
    } else {
      console.log("Skipping save on exit: required data missing or percentage unchanged.");
    }
  }

// Modify loadBookHtml to trigger the scroll AFTER load
  private loadBookHtml(bookId: number, isBase: boolean = false): void {
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
    this.chapterNav = [];
    this.cdRef.markForCheck();
    this.needsHeightSync = false

    const stream$ = isBase
      ? this.readService.loadBook(bookId)
      : this.readService.getParallelText(bookId, this.selectedLangCode!); // Use selectedLangCode here

    stream$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.status === 200 && response.body) {
          try {
            const fetchedHtml = this.arrayBufferToString(response.body);
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
            console.log(`Loaded ${isBase ? 'base' : 'parallel'} HTML content.`);
            this.currentlyOpenUkrSpan = null;
            this.cdRef.markForCheck(); // Ensure view updates with content

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
      error: (error) => this.handleLoadError(isBase ? 'base' : 'parallel', error?.error?.message || 'Unknown error loading content.'),
    });
  }

  // attemptInitialScroll checks everything and scrolls if needed
  private attemptInitialScroll(): void {
    // Added check: Don't attempt if component destroyed
    if (this.isDestroyed) {
      return;
    }

    // Conditions: Not loading, target known, not applied yet, wrapper exists
    if (!this.isLoading && !this.isLoadingParallel && this.initialScrollPercentage !== null && !this.initialScrollApplied && this.readerContentWrapperRef?.nativeElement) {
      const target = this.initialScrollPercentage;
      // Add extra check for scrollHeight to ensure layout is likely ready
      const scrollHeight = this.readerContentWrapperRef.nativeElement.scrollHeight;
      const clientHeight = this.readerContentWrapperRef.nativeElement.clientHeight;

      if (scrollHeight > 0 && (scrollHeight > clientHeight || target === 0)) { // Check scrollHeight > 0 and scroll is possible or target is 0
        console.log(`Attempting initial scroll to target: ${target}% (scrollHeight: ${scrollHeight})`);
        this.scrollToPercentage(target);
        this.initialScrollApplied = true; // Mark as applied
      } else {
        console.log(`Skipped initial scroll attempt (in ngAfterViewChecked): scrollHeight not ready or not scrollable. scrollHeight=${scrollHeight}, clientHeight=${clientHeight}, target=${target}`);
      }
    } else if (!this.initialScrollApplied && this.initialScrollPercentage !== null) {
      // Log only if we expected to scroll but didn't yet
      // console.log(`Skipped initial scroll attempt (in ngAfterViewChecked): isLoading=${this.isLoading}, target=${this.initialScrollPercentage}, applied=${this.initialScrollApplied}, wrapper=${!!this.readerContentWrapperRef?.nativeElement}`);
    }
  }


  // Reverts the view to the base language content
  private revertToBaseContent(): void {
    console.log("Reverting to base content.");

    // Check if content or state actually needs reverting
    if (this.bookHtmlContent !== this.baseBookHtmlContent || this.isParallelViewActive || this.selectedLangCode !== null) {
      this.bookHtmlContent = this.baseBookHtmlContent;
      this.isParallelViewActive = false;
      this.currentlyOpenUkrSpan = null;
      this.selectedLangCode = null;

      this.isLoadingParallel = false;
      this.cdRef.markForCheck();

      this.initialScrollApplied = false; // Re-apply the scroll when content changes
      console.log("Reverted to base, flags set for ngAfterViewChecked.");
    } else {
      console.log("Already in base content state.");
    }
  }

  // Placeholder fetch for parallel languages options
  private fetchBookData(bookId: number): void {
    this.readService.getMiniBookDetailsById(bookId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (book) => {
        if (book) {
          this.parallelVersions = book.languageVariants.filter(t => t.language !== book.language);
          this.initialScrollPercentage = book.progressPercentage ?? 0;
          console.log(`Stored initial scroll target: ${this.initialScrollPercentage}%`);
          this.cdRef.markForCheck();
        }
      },
      error: (error) => console.error('Error fetching book details for parallel options:', error)
    });
  }

  // General error handler
  private handleError(message: string): void {
    console.error("Reader Error:", message);
    this.errorMessage = message;
    this.isLoading = false;
    this.processedContent = '';
    this.blocks = [];
    this.chapterNav = [];
    this.currentScrollPercentage = 0;
    this.cdRef.markForCheck();
  }

  // --- Chapter Offset Measurement ---
  // Measures the top offset of rendered chapter elements relative to the scroll container
  // --- Chapter Offset Measurement (Adapted for Direct HTML) ---
  private measureChapterOffsets(): boolean {
    // This function should now ONLY run successfully ONCE for BASE content
    if (this.hasMeasuredChapters || this.isParallelViewActive || !this.baseBookHtmlContent) {
      return this.hasMeasuredChapters;
    }

    const contentElement = this.readerContentRef?.nativeElement;
    const wrapperElement = this.readerContentWrapperRef?.nativeElement;

    if (!contentElement || !wrapperElement || this.isLoading) {
      console.warn("measureChapterOffsets (Base): Prerequisites not met.");
      return false;
    }

    console.log("Measuring BASE chapter offsets from rendered HTML (using H2 IDs)..."); // Updated log
    const newChapterNav: ChapterNavInfo[] = [];

    // Find original H2s in BASE content
    const headingElements = contentElement.querySelectorAll('h2');
    console.log(`Base Mode Measurement: Found ${headingElements.length} potential chapter heading H2s.`);

    headingElements.forEach((headingElement: HTMLElement, index: number) => {
      let title = `Chapter ${index + 1}`;
      let elementId = '';
      let offsetTop = headingElement.offsetTop ?? 0;

      // ********* ID: Get the ID directly from the H2 element *********
      elementId = headingElement.id; // <<<< CHANGE IS HERE

      // Check if the H2 actually has an ID and optionally if it matches the pattern
      if (!elementId /* || !elementId.startsWith('chap') */) { // <<<< ADDED CHECK
        // If no ID (or pattern doesn't match), skip this chapter.
        console.warn(`Chapter measurement (Base): H2 at index ${index} lacks an ID (or required pattern 'chap*'). Skipping this chapter.`);
        console.log('Problematic H2:', headingElement); // Log the element for easier debugging
        return; // Skip this iteration
      }
      // ***************************************************************


      // Title: ALWAYS use English title from base H2 structure (No change needed here)
      const engSpan = headingElement.querySelector<HTMLElement>('span.eng');
      if (engSpan) {
        title = engSpan.innerText?.replace(/\s+/g, ' ').trim() || title;
      } else {
        title = headingElement.innerText?.replace(/\s+/g, ' ').trim() || title;
        // console.warn(`Chapter measurement (Base): Couldn't find span.eng in H2 at index ${index}. Used full H2 text.`);
      }

      // Store chapter info with its index
      // console.log(`Storing Base Chapter: ${title} (ID: ${elementId}, Index: ${index}) at offset ${offsetTop}px`);
      newChapterNav.push({
        title: title,         // English title
        offsetTop: offsetTop, // Initial offset
        elementId: elementId, // Original ID from H2
        index: index          // Store the index
      });

    }); // End forEach loop

    this.chapterNav = newChapterNav.sort((a, b) => a.offsetTop - b.offsetTop); // Store sorted list
    console.log(`Stored ${this.chapterNav.length} base chapters using H2 IDs.`); // Updated log

    return this.chapterNav.length > 0; // Return true if we found any chapters
  }


  // Schedules chapter measurement reliably after view updates
  private scheduleChapterOffsetMeasurement(): void {
    requestAnimationFrame(() => {
      if (this.isDestroyed) {
        console.log("scheduleChapterOffsetMeasurement: Component destroyed, skipping.");
        return;
      }
      const measurementSuccess = this.measureChapterOffsets();
      if (measurementSuccess) {
        this.updateScrollState(); // Update scroll state based on new measurements
        this.cdRef.markForCheck(); // Update dropdown
      } else {
        console.warn("scheduleChapterOffsetMeasurement: Measurement failed or refs not ready.");
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
      console.log('Window resized...');
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
      console.log(`Slider target percentage: ${percentage}`);
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
    const element = this.readerContentWrapperRef.nativeElement;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;
    const scrollThreshold = 2; // Small pixel threshold to account for rounding/subpixels
    let newPercentage: number; // Calculate the new percentage

    if (scrollHeight <= clientHeight) {
      // Content doesn't scroll or is exactly fitting
      newPercentage = scrollTop <= scrollThreshold ? 0 : 100; // Consider it 0 if at top, 100 if scrolled down somehow
      this.isAtScrollTop = true;
      this.isAtScrollBottom = true;
    } else {
      // Standard percentage calculation
      const calculatedPercentage = (scrollTop / (scrollHeight - clientHeight)) * 100;
      newPercentage = Math.max(0, Math.min(100, Math.round(calculatedPercentage))); // Round to nearest integer

      this.isAtScrollTop = scrollTop <= scrollThreshold;
      this.isAtScrollBottom = scrollTop >= (scrollHeight - clientHeight - scrollThreshold);
    }

    // Only update the property and emit if the rounded percentage has changed
    if (newPercentage !== this.currentScrollPercentage) {
      console.log(`Scroll state updated: New percentage = ${newPercentage}%`); // Optional log
      this.currentScrollPercentage = newPercentage; // Update the component property
      this.progressUpdate$.next(newPercentage);   // Emit the change for saving logic
    }
  }

// Keep the guards in scrollToPercentage
  private scrollToPercentage(percentage: number): void {
    console.log(`Executing scrollToPercentage: ${percentage}%`);
    if (!this.readerContentWrapperRef?.nativeElement) {
      console.warn(`scrollToPercentage (${percentage}%): Wrapper ref not available.`);
      return;
    }

    const element = this.readerContentWrapperRef.nativeElement;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;

    if (scrollHeight <= 0 || clientHeight <= 0) {
      console.warn(`scrollToPercentage (${percentage}%): Invalid dimensions (scrollHeight=${scrollHeight}, clientHeight=${clientHeight}). Cannot scroll.`);
      return;
    }
    if (scrollHeight <= clientHeight) {
      console.log(`scrollToPercentage (${percentage}%): Content not scrollable (scrollHeight <= clientHeight).`);
      return;
    }

    const targetScrollTop = (percentage / 100) * (scrollHeight - clientHeight);
    console.log(`scrollToPercentage (${percentage}%): Calculated targetScrollTop=${Math.round(targetScrollTop)} from scrollHeight=${scrollHeight}, clientHeight=${clientHeight}`);
    this.setScrollTop(Math.round(targetScrollTop));
  }

  // Centralized method to set scrollTop and manage the programmatic scroll flag
  private setScrollTop(value: number): void {
    if (!this.readerContentWrapperRef) return;
    const element = this.readerContentWrapperRef.nativeElement;

    // Clamp value to valid scroll range
    const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
    const clampedValue = Math.max(0, Math.min(value, maxScrollTop));

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
      setTimeout(() => {
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
  protected onTouchStart(event: TouchEvent): void {
    this.isTouching = true;
    this.clearScrollHoldTimers(); // Prevent hold scroll if touch interaction starts
  }

  protected onTouchMove(event: TouchEvent): void { /* Browser handles native scroll */
  }

  protected onTouchEnd(event: TouchEvent): void {
    this.isTouching = false;
  }

  protected onTouchCancel(event: TouchEvent): void {
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
      console.log("Performing single page action on click/release.");
      if (triggerAction === 'prev') this.prevPage();
      else this.nextPage();
    } else if (wasHoldScrollActive) {
      console.log("Hold scroll stopped.");
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

  // --- Chapter Navigation ---
  // Scrolls to the measured offsetTop of a selected chapter
  protected jumpToChapter(chapterIndex: number): void { // Parameter is index
    if (this.isLoading || !this.readerContentWrapperRef || chapterIndex < 0 || chapterIndex >= this.chapterNav.length) {
      console.warn(`Cannot jump: Invalid chapter index ${chapterIndex} or prerequisites not met.`);
      return;
    }

    const contentElement = this.readerContentRef?.nativeElement;
    if (!contentElement) {
      console.warn(`Cannot jump: contentElement not available.`);
      return;
    }

    // 1. Get the stored info, including the unique elementId ('chapX')
    const targetChapterInfo = this.chapterNav[chapterIndex];
    if (!targetChapterInfo || !targetChapterInfo.elementId) {
      console.warn(`Cannot jump: Chapter info or elementId missing for index ${chapterIndex}.`);
      return;
    }

    console.log(`Jumping to chapter index: ${chapterIndex} (Title: ${targetChapterInfo.title}, ID: ${targetChapterInfo.elementId})`); // Log the ID

    let elementToScrollTo: HTMLElement | null = null;

    try {
      // 2. Find the element DIRECTLY BY ITS ID - REMOVE THE FILTERING
      elementToScrollTo = contentElement.querySelector<HTMLElement>(`#${targetChapterInfo.elementId}`);

      if (!elementToScrollTo) {
        console.warn(`Cannot jump: Could not find element with ID '${targetChapterInfo.elementId}' within contentElement.`);
        return; // Exit if element not found by ID
      }

    } catch (error) {
      console.error("Error during DOM query in jumpToChapter:", error);
      return; // Exit on error
    }

    // Perform the scroll if element found
    if (elementToScrollTo) {
      console.log(`Scrolling to element for index ${chapterIndex} (ID: ${targetChapterInfo.elementId}):`, elementToScrollTo);
      elementToScrollTo.scrollIntoView({behavior: 'smooth', block: 'start'});
      // Update percentage after scroll finishes
      setTimeout(() => {
        if (!this.isDestroyed) {
          this.updateScrollState();
          this.cdRef.markForCheck();
        }
      }, 350); // Increased timeout slightly just in case
    } else {
      console.warn(`Cannot jump: Final check failed, elementToScrollTo is null for ID ${targetChapterInfo.elementId}.`);
    }
  }

// Modify selectChapter to pass the INDEX
  protected selectChapter(chapterIndex: number): void { // Parameter is now index
    console.log("Chapter selected by index:", chapterIndex);
    if (chapterIndex !== null && chapterIndex >= 0) {
      this.jumpToChapter(chapterIndex);
    } else {
      console.warn("Invalid index received from chapter selection:", chapterIndex);
    }
  }

  // Decodes ArrayBuffer response to string
  private arrayBufferToString(buffer: ArrayBuffer): string {
    try {
      const decoder = new TextDecoder('utf-8', {fatal: true});
      return decoder.decode(buffer);
    } catch (e) {
      console.warn("UTF-8 decoding failed, trying fallback.", e);
      // Fallback to windows-1252 or latin1 might be needed depending on source files
      const decoder = new TextDecoder('windows-1252');
      return decoder.decode(buffer);
    }
  }

  // Getter for parallel language options used in template
  get langs() {
    return this.parallelVersions.map(t => t.language);
  }

  get availableLangs(): string[] {
    console.log('Recalculating availableLangs'); // Add this to see how often it runs
    return this.langs.filter(l => l !== this.selectedLangCode);
  }

  private parallelLoadSubscription: Subscription | null = null;

  selectOption(langCode: string | null): void { // Allow null if you add a way to deselect
    console.log("Language selected:", langCode);

    if (langCode !== null && langCode === this.selectedLangCode) {
      console.log(`Language ${langCode} is already selected.`);
      // Optionally close the dropdown here if needed, depending on your template structure
      return; // Exit early
    }

    // --- 1. Cancel Previous Request ---
    this.parallelLoadSubscription?.unsubscribe();

    this.selectedLangCode = langCode;

    // --- 2. Handle Selection ---
    if (langCode && this.bookId) {
      // --- 2a. Start Loading Process ---

      // Perform pre-fetch UI updates (from original 'tap')
      if (this.currentlyOpenUkrSpan) {
        this.currentlyOpenUkrSpan.hidden = true;
        this.currentlyOpenUkrSpan = null;
      }
      this.isParallelViewActive = false; // Tentatively set false
      this.isLoadingParallel = true;    // Show loader
      this.errorMessage = null;         // Clear previous errors
      this.cdRef.markForCheck();        // Update UI

      // Initiate the network call (from original 'switchMap')
      this.parallelLoadSubscription = this.readService.getParallelText(this.bookId, langCode).pipe(
        takeUntil(this.destroy$), // Auto-unsubscribe on component destroy
        finalize(() => {
          // Runs on completion, error, or unsubscribe
          this.isLoadingParallel = false; // ALWAYS hide loader eventually
          this.cdRef.markForCheck();
        }),
        catchError(error => {
          // Handle error within the stream (from original 'catchError')
          this.handleLoadError('parallel', error?.error?.message || 'Unknown error fetching parallel content.');
          this.revertToBaseContent(); // Revert UI on error
          return EMPTY; // Prevent observable from completing incorrectly
        })
      ).subscribe({
        next: (response) => {
          // Handle successful response (from original 'subscribe.next')
          if (response.status === 200 && response.body) {
            try {
              // Decode and update content
              this.bookHtmlContent = this.arrayBufferToString(response.body);
              this.isParallelViewActive = true;   // Now parallel view is active
              this.errorMessage = null;         // Clear previous errors
              console.log(`Loaded parallel HTML content for ${langCode}.`);
              // Trigger layout updates and scrolling
              // *** Schedule height sync AFTER parallel content is loaded AND if in side mode ***
              // Note: Pipe re-runs automatically due to cdRef.markForCheck()
              if (this.currentParallelMode === 'side') {
                this.needsHeightSync = true;
              }
              console.log("Parallel content loaded, flags set for ngAfterViewChecked.");
              // We also want to reset scroll to top when changing language
              this.initialScrollPercentage = 0; // Target 0%
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
          console.error("Unexpected error in parallel load subscription:", err);
          this.handleLoadError('parallel', 'An unexpected error occurred during parallel load.');
          this.revertToBaseContent(); // Revert UI on unexpected error
          // isLoadingParallel is handled by finalize
          this.cdRef.markForCheck();
        }
      });

    } else {
      // --- 2b. Language Deselected or Missing bookId: Revert to Base ---
      console.log("Reverting to base content (no valid language selected or missing bookId).");
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
