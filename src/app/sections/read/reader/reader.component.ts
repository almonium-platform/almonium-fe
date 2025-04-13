import {
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
import {CommonModule, SlicePipe} from '@angular/common'; // Import SlicePipe
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {TuiAlertService, TuiButton, TuiDropdownDirective} from '@taiga-ui/core';
import {EMPTY, finalize, Subject, Subscription} from 'rxjs';
import {catchError, debounceTime, distinctUntilChanged, switchMap, takeUntil, tap, throttleTime} from 'rxjs/operators'; // Add throttleTime
import {SharedLucideIconsModule} from "../../../shared/shared-lucide-icons.module";
import {ButtonComponent} from "../../../shared/button/button.component";
import {TuiDataListDropdownManager, TuiSliderComponent} from "@taiga-ui/kit";
import {ActivatedRoute, Router} from "@angular/router";
import {BookMini} from "../book.model";
import {TuiSelectModule, TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {TuiActiveZone} from "@taiga-ui/cdk";
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";
import {ParallelFormatPipe} from "./parallel-format.pipe";
import {LoadingIndicatorComponent} from "../../../shared/loading-indicator/loading-indicator.component";
import {ParallelTranslationComponent} from "../parallel-translation/parallel-translation.component";
import {PopupTemplateStateService} from "../../../shared/modals/popup-template/popup-template-state.service";
import {ParallelSettingsComponent} from "../../../parallel-settings/parallel-settings.component";
import {DEFAULT_PARALLEL_MODE, ParallelMode} from '../parallel-mode.type';
import {ParallelModeService} from "../parallel-mode.service";

// Data structure for parsed blocks
interface BlockData {
  type: 'paragraph' | 'verse' | 'chapter';
  content: string; // The text content, potentially with <em>/<strong>
  originalIndex: number; // Use for unique IDs
}

interface TextSegment {
  type: 'segment';
  eng: string;
  ukr: string;
}

interface HtmlElementNode {
  type: 'element';
  tagName: string;
  attributes: { [key: string]: string };
  children: Array<HtmlElementNode | TextSegment | string>; // Allow mixed content
}

// Simplified Chapter Info for navigation
interface ChapterNavInfo {
  title: string;
  offsetTop: number; // Store the measured pixel offset
  elementId: string; // Store the ID for potential requery / debugging
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

const CHAPTER_MARKER = "CHAPTER:::"; // Must match Python

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
    TuiSelectModule,
    TuiTextfieldControllerModule,
    SlicePipe,
    TuiActiveZone,
    SafeHtmlPipe,
    ParallelFormatPipe,
    LoadingIndicatorComponent,
    ParallelTranslationComponent,
    TuiDataListDropdownManager,
    ParallelSettingsComponent,
    TuiButton,
    ParallelFormatPipe,
    ParallelFormatPipe,
    ParallelFormatPipe,
  ],
  templateUrl: './reader.component.html',
  styleUrls: ['./reader.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReaderComponent implements OnInit, AfterViewInit, OnDestroy {
  // --- Element References ---
  @ViewChild('readerContainer') readerContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('readerContentWrapper') readerContentWrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('readerContent') readerContentRef!: ElementRef<HTMLDivElement>;
  @ViewChild('paginationControls') paginationControlsRef!: ElementRef<HTMLDivElement>;

  // --- State Properties ---
  private processedContent: string = '';    // Raw text from backend
  protected blocks: BlockData[] = [];       // Parsed blocks for rendering
  protected chapterNav: ChapterNavInfo[] = []; // Store chapter offsets for navigation
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
  protected parallelVersions: BookMini[] = [];
  protected languageSelectControl = new FormControl<string | null>(null);
  protected isParallelViewActive: boolean = false; // Still needed to know *if* content has translations
  private currentlyOpenUkrSpan: HTMLElement | null = null;

  protected isAtScrollTop: boolean = true; // ADDED: True initially
  protected isAtScrollBottom: boolean = false; // ADDED: False initially

  protected currentParallelMode: ParallelMode = DEFAULT_PARALLEL_MODE;
  protected selectedLangCode: string | null = null;
  private isSyncingHeights = false;

  constructor(
    private cdRef: ChangeDetectorRef,
    private readService: ReadService,
    private alertService: TuiAlertService,
    private router: Router,
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
        this.loadBookHtml(this.bookId, true);
        // Fetch the list of available languages for the dropdown
        this.fetchParallelLanguages(this.bookId);
        // Setup listener for language selection changes AFTER initial load might start
        this.setupLanguageSelectionListener();
      } else {
        this.handleError("Invalid Book ID.");
      }
    });
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
  private synchronizeColumnHeights(): void {
    if (this.isSyncingHeights || this.currentParallelMode !== 'side' || !this.readerContentRef?.nativeElement) {
      return;
    }

    this.isSyncingHeights = true;
    console.log("Synchronizing PARAGRAPH heights within columns...");
    const contentElement = this.readerContentRef.nativeElement;

    // Find the main columns (assuming there's only one pair based on screenshot)
    const engCol = contentElement.querySelector<HTMLDivElement>('.sbs-eng-column');
    const ukrCol = contentElement.querySelector<HTMLDivElement>('.sbs-ukr-column');

    if (!engCol || !ukrCol) {
      console.warn("Height Sync: Could not find main ENG or UKR columns.");
      this.isSyncingHeights = false;
      return;
    }

    // Find all PARAGRAPHS within each column
    // Note: This includes H2 as well if we use a general selector, adjust if needed
    const engBlocks = engCol.querySelectorAll<HTMLElement>('p, h2'); // Select p AND h2 for alignment
    const ukrBlocks = ukrCol.querySelectorAll<HTMLElement>('p, h2');


    // Check if counts match (they should if the pipe generated them correctly)
    if (engBlocks.length !== ukrBlocks.length) {
      console.warn(`Height Sync: Mismatch in number of blocks between columns (${engBlocks.length} vs ${ukrBlocks.length}). Alignment might be incorrect.`);
      // Decide how to proceed - maybe only align up to the minimum count?
    }

    let changesMade = false;
    const numBlocksToAlign = Math.min(engBlocks.length, ukrBlocks.length);

    for (let i = 0; i < numBlocksToAlign; i++) {
      const engP = engBlocks[i];
      const ukrP = ukrBlocks[i];

      // Reset heights first to get natural height
      engP.style.minHeight = ''; // Reset using empty string
      ukrP.style.minHeight = '';
      // Also reset potential margins if they interfere (or adjust CSS)
      // engP.style.marginBottom = '';
      // ukrP.style.marginBottom = '';

      // Force reflow for this pair
      const engHeight = engP.offsetHeight; // Use offsetHeight for visible block height
      const ukrHeight = ukrP.offsetHeight;
      const maxHeight = Math.max(engHeight, ukrHeight);

      // console.log(`  Block Pair ${i + 1} (<${engP.tagName}>): EngH=${engHeight}, UkrH=${ukrHeight}, MaxH=${maxHeight}`);

      // Apply the max height as min-height to BOTH blocks if needed
      if (Math.abs(engHeight - maxHeight) > 1) { // Threshold of 1px
        engP.style.minHeight = `${maxHeight}px`;
        changesMade = true;
      }
      if (Math.abs(ukrHeight - maxHeight) > 1) { // Threshold of 1px
        ukrP.style.minHeight = `${maxHeight}px`;
        changesMade = true;
      }
      // Ensure consistent bottom margin (adjust value as needed or handle in CSS)
      // engP.style.marginBottom = '1em';
      // ukrP.style.marginBottom = '1em';
    }

    console.log(`Paragraph height synchronization complete. Changes applied: ${changesMade}`);
    this.isSyncingHeights = false;

    // Trigger Angular updates if needed
    if (changesMade) {
      this.ngZone.run(() => {
        this.updateScrollState();
        this.scheduleChapterOffsetMeasurement(); // Recalculate chapter offsets
        this.cdRef.markForCheck();
      });
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
    requestAnimationFrame(() => {
      this.updateScrollState();
      this.cdRef.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearScrollHoldTimers();
    this.parallelLoadSubscription?.unsubscribe();
  }

  // Loads HTML content, stores in baseBookHtmlContent if isBase=true
  private loadBookHtml(bookId: number, isBase: boolean = false): void {
    if (isBase) {
      this.isLoading = true; // Use main loader for base content
      this.isParallelViewActive = false; // Reset flag
    } else {
      this.isLoadingParallel = true; // Use specific loader for parallel
    }
    this.errorMessage = null;
    // Reset content relevant to the current load type
    if (isBase) this.baseBookHtmlContent = '';
    this.bookHtmlContent = ''; // Always clear current display content on load
    this.chapterNav = [];
    this.currentScrollPercentage = 0; // Reset scroll
    this.cdRef.markForCheck();

    // Use the correct service method
    const stream$ = isBase
      ? this.readService.loadBook(bookId)
      : this.readService.getParallelText(bookId, this.languageSelectControl.value!); // Assumes value is set

    stream$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.status === 200 && response.body) {
          try {
            const fetchedHtml = this.arrayBufferToString(response.body);
            this.bookHtmlContent = fetchedHtml; // Store in current display
            if (isBase) {
              this.baseBookHtmlContent = fetchedHtml; // Also store in base copy
              this.isParallelViewActive = false;
            } else {
              this.isParallelViewActive = true;
            }
            this.isLoading = false;
            this.isLoadingParallel = false;
            this.errorMessage = null;
            console.log(`Loaded ${isBase ? 'base' : 'parallel'} HTML content.`);
            this.currentlyOpenUkrSpan = null; // Reset any open translations
            this.cdRef.markForCheck();
            this.scheduleChapterOffsetMeasurement(); // Remeasure after new content render
            this.scrollToPercentage(0); // Scroll to top after load
            if (this.currentParallelMode === 'side') {
              this.scheduleHeightSync();
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

  // Reverts the view to the base language content
  private revertToBaseContent(): void {
    console.log("Reverting to base content.");

    // Check if content or state actually needs reverting
    if (this.bookHtmlContent !== this.baseBookHtmlContent || this.isParallelViewActive || this.selectedLangCode !== null) {
      this.bookHtmlContent = this.baseBookHtmlContent;
      this.isParallelViewActive = false;
      this.currentlyOpenUkrSpan = null; // Reset specific UI state if needed
      this.selectedLangCode = null;

      this.isLoadingParallel = false; // Ensure parallel loader is off
      this.cdRef.markForCheck();      // Trigger change detection
      this.scheduleChapterOffsetMeasurement(); // Remeasure layout
      this.updateScrollState();        // Update scroll state based on base content (if method exists)
    } else {
      console.log("Already in base content state.");
    }
  }

  // Placeholder fetch for parallel languages options
  private fetchParallelLanguages(bookId: number): void {
    this.readService.getBookById(bookId, this.currentBaseLanguage).pipe(takeUntil(this.destroy$)).subscribe({
      next: (book) => {
        if (book) {
          this.parallelVersions = book.availableLanguages.filter(t => t.language !== book.language);
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
  private measureChapterOffsets(): void {
    const contentElement = this.readerContentRef?.nativeElement;
    if (!contentElement || this.isLoading) {
      if (!contentElement) console.warn("measureChapterOffsets: readerContentRef.nativeElement is not available yet.");
      return;
    }

    console.log("Measuring chapter offsets from rendered HTML...");
    this.chapterNav = []; // Clear existing nav items

    const chapterAnchors = contentElement.querySelectorAll('a[id^="chap"]');
    console.log(`Found ${chapterAnchors.length} potential chapter anchors.`);

    chapterAnchors.forEach((anchor: Element) => {
      const elementId = anchor.id;
      // Find the closest H2 ancestor of the anchor
      const headingElement = anchor.closest('h2') as HTMLElement | null;

      if (headingElement && elementId) {

        // *** FILTERING LOGIC ***
        // Check if this specific H2 element is located inside a Ukrainian column.
        // .closest() searches ancestors. If it finds '.sbs-ukr-column', skip this H2.
        const isInsideUkrColumn = headingElement.closest('.sbs-ukr-column');

        if (isInsideUkrColumn) {
          // console.log(`Skipping H2 with anchor ${elementId} because it's inside .sbs-ukr-column.`);
          return; // Skip to the next anchor
        }
        // *********************

        // If we reach here, the H2 is NOT inside a Ukrainian column (it's the English one)
        const offsetTopRelativeToWrapper = headingElement.offsetTop;

        // Now, get the title ONLY from the English column within THIS heading, if possible
        let title = `Chapter (ID: ${elementId})`; // Default fallback
        let titleSourceElement: HTMLElement | null = null;

        // In side mode, try to find the English column *within this specific H2*
        if (this.currentParallelMode === 'side') {
          titleSourceElement = headingElement.querySelector<HTMLElement>('.sbs-eng-column');
          // console.log(`Side mode check for H2 (${elementId}): Found eng column? ${!!titleSourceElement}`);
        }

        // If we didn't find an English column inside (e.g., not side mode, or structure differs),
        // or if we explicitly want the heading text regardless of column structure for non-side mode:
        if (!titleSourceElement || this.currentParallelMode !== 'side') {
          titleSourceElement = headingElement; // Fallback to the H2 itself
        }

        // Extract text from the determined source
        if (titleSourceElement) {
          // Use innerText as it might be better at getting visible text
          title = titleSourceElement.innerText?.replace(/\s+/g, ' ').trim() || title;
        }

        this.chapterNav.push({
          title: title,
          offsetTop: offsetTopRelativeToWrapper,
          elementId: elementId
        });

      } else {
        if (!headingElement) console.warn(`Could not find parent H2 for anchor with ID: ${elementId}`);
        else console.warn("Found chapter anchor without ID:", anchor);
      }
    });

    // Sort by position
    this.chapterNav.sort((a, b) => a.offsetTop - b.offsetTop);
    console.log(`Found and measured ${this.chapterNav.length} valid chapters (filtered).`);
  }

  // Schedules chapter measurement reliably after view updates
  private scheduleChapterOffsetMeasurement(): void {
    // Use NgZone.runOutsideAngular if measurement becomes complex/slow
    // Use requestAnimationFrame to wait for browser layout/paint
    requestAnimationFrame(() => {
      this.measureChapterOffsets();
      this.updateScrollState(); // Set initial percentage
      this.cdRef.markForCheck(); // Update chapter dropdown if needed
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

    if (scrollHeight <= clientHeight) {
      this.currentScrollPercentage = 0;
      this.isAtScrollTop = true;
      this.isAtScrollBottom = true;
    } else {
      const percentage = (scrollTop / (scrollHeight - clientHeight)) * 100;
      this.currentScrollPercentage = Math.max(0, Math.min(100, Math.round(percentage)));

      this.isAtScrollTop = scrollTop <= scrollThreshold;
      this.isAtScrollBottom = scrollTop >= (scrollHeight - clientHeight - scrollThreshold);
    }
  }

  // Scrolls the wrapper to a position corresponding to the given percentage
  private scrollToPercentage(percentage: number): void {
    if (!this.readerContentWrapperRef) return;
    const element = this.readerContentWrapperRef.nativeElement;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;

    if (scrollHeight <= clientHeight) return; // Cannot scroll

    const targetScrollTop = (percentage / 100) * (scrollHeight - clientHeight);
    this.setScrollTop(Math.round(targetScrollTop)); // Use Math.round for integer pixels
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
  protected jumpToChapter(elementId: string): void {
    if (this.isLoading || !this.readerContentWrapperRef) return;
    const contentElement = this.readerContentRef?.nativeElement;
    if (!contentElement) return;
    const element = contentElement.querySelector(`#${elementId}`) as HTMLElement; // Find within content

    if (element) {
      console.log(`Jumping to chapter element ID: ${elementId}`);
      element.scrollIntoView({behavior: 'smooth', block: 'start'});
      // Update percentage after scroll finishes
      setTimeout(() => {
        this.updateScrollState();
        this.cdRef.markForCheck();
      }, 350);
    } else {
      console.warn(`Cannot jump: Chapter element with ID ${elementId} not found.`);
    }
  }

  // Handles selection change in the chapter dropdown
  protected selectChapter(elementId: string): void {
    console.log("Chapter selected:", elementId);
    if (elementId) {
      this.jumpToChapter(elementId);
    } else {
      console.warn("Invalid elementId received from chapter selection:", elementId);
    }
  }


  // --- Utility / Other ---
  // Navigates back to the main reading list/library view
  goBack() {
    this.router.navigate(['/read']); // Adjust path if needed
  }

  // TrackBy function for *ngFor rendering blocks
  protected trackBlock(index: number, block: BlockData): number {
    return block.originalIndex; // Use original index for stability
  }

  // Generates a unique ID for chapter elements for querying
  protected getChapterId(block: BlockData): string | null {
    return block.type === 'chapter' ? `ch-${block.originalIndex}` : null; // Keep prefix simple
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

  protected closeActionsDropdown($event: boolean, friendDropdown: TuiDropdownDirective) {
    if (!$event) {
      friendDropdown.toggle(false);
    }
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
                this.scheduleHeightSync();
              }
              this.scheduleChapterOffsetMeasurement();
              this.scrollToPercentage(0);
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

  protected mode: 'side' | 'overlay' | 'inline' = 'inline'; // Default to side-by-side

  setMode(mode: 'side' | 'overlay' | 'inline') {
    this.mode = mode;
  }

  @ViewChild(ParallelSettingsComponent, {static: true}) parallelSettingsComponent!: ParallelSettingsComponent;

  openParallelSettings() {
    this.popupTemplateStateService.open(this.parallelSettingsComponent.content, 'avatar');
  }
}
