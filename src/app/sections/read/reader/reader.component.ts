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
import {TuiAlertService} from '@taiga-ui/core';
import {EMPTY, Subject} from 'rxjs';
import {catchError, debounceTime, distinctUntilChanged, switchMap, takeUntil, tap, throttleTime} from 'rxjs/operators'; // Add throttleTime
import {SharedLucideIconsModule} from "../../../shared/shared-lucide-icons.module";
import {ButtonComponent} from "../../../shared/button/button.component";
import {TuiDataListWrapperComponent, TuiSliderComponent} from "@taiga-ui/kit";
import {ActivatedRoute, Router} from "@angular/router";
import {BookMini} from "../book.model";
import {TuiSelectModule, TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {HttpResponse} from "@angular/common/http";
import {TuiActiveZone} from "@taiga-ui/cdk";
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";
import {ParallelFormatPipe} from "./parallel-format.pipe";

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
    TuiDataListWrapperComponent,
    TuiSelectModule,
    TuiTextfieldControllerModule,
    SlicePipe,
    TuiActiveZone,
    SafeHtmlPipe,
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
  protected displayMode: 'eng-ukr' | 'eng' | 'ukr' = 'eng'; // Display format for the pipe
  private currentlyOpenUkrSpan: HTMLElement | null = null;

  protected isAtScrollTop: boolean = true; // ADDED: True initially
  protected isAtScrollBottom: boolean = false; // ADDED: False initially

  constructor(
    private cdRef: ChangeDetectorRef,
    private readService: ReadService,
    private alertService: TuiAlertService,
    private router: Router,
    private route: ActivatedRoute,
    private ngZone: NgZone // Inject NgZone for performance optimization
  ) {
  }

  // --- Lifecycle Hooks ---

  ngOnInit(): void {
    this.setupResizeListener();
    this.setupSliderListener();
    this.setupScrollListener();
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

  protected onContentClick(event: MouseEvent): void {
    if (!this.isParallelViewActive) return; // Only handle clicks in parallel mode

    const target = event.target as HTMLElement;

    // Check if the clicked element is, or is inside, an English segment span
    const engSpan = target.closest('span.eng');

    if (engSpan) {
      // Find the parent seg-pair container
      const segPair = engSpan.closest('span.seg-pair');
      if (segPair) {
        // Find the corresponding Ukrainian span within the same pair
        const ukrSpan = segPair.querySelector('span.ukr') as HTMLElement | null;
        if (ukrSpan) {
          // --- Toggle Visibility ---
          // Option 1: Toggle a class on the parent
          // segPair.classList.toggle('show-translation');

          // Option 2: Toggle the 'hidden' attribute directly
          ukrSpan.hidden = !ukrSpan.hidden;

          console.log(`Toggled translation for: ${engSpan.textContent?.trim()}`);
        }
      }
    }
  }

// --- Language Selection Listener ---
  private setupLanguageSelectionListener(): void {
    this.languageSelectControl.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged(), // Compare previous selection if needed
        tap(langCode => console.log("Language selected:", langCode)),
        // Use switchMap to automatically cancel previous load request if user selects quickly
        switchMap(langCode => {
          if (langCode && this.bookId) {
            this.isLoadingParallel = true; // Show parallel loading indicator
            this.isParallelViewActive = false; // Tentatively set false until loaded
            this.cdRef.markForCheck();
            // Fetch the parallel content
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
              const fetchedHtml = this.arrayBufferToString(response.body);
              this.bookHtmlContent = fetchedHtml; // Store in current display
              this.isParallelViewActive = true;   // Now parallel view is active
              this.displayMode = 'eng-ukr';     // Default to side-by-side view
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
  }

  // Loads HTML content, stores in baseBookHtmlContent if isBase=true
  private loadBookHtml(bookId: number, isBase: boolean = false): void {
    if (isBase) {
      this.isLoading = true; // Use main loader for base content
      this.isParallelViewActive = false; // Reset flag
      this.displayMode = 'eng'; // Default to eng when loading base
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
              this.displayMode = 'eng';
            } else {
              this.isParallelViewActive = true;
              this.displayMode = 'eng-ukr'; // Default parallel view
            }
            this.isLoading = false;
            this.isLoadingParallel = false;
            this.errorMessage = null;
            console.log(`Loaded ${isBase ? 'base' : 'parallel'} HTML content.`);
            this.cdRef.markForCheck();
            this.scheduleChapterOffsetMeasurement(); // Remeasure after new content render
            this.scrollToPercentage(0); // Scroll to top after load
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
    if (this.bookHtmlContent !== this.baseBookHtmlContent) { // Only update if different
      this.bookHtmlContent = this.baseBookHtmlContent;
      this.isParallelViewActive = false;
      this.displayMode = 'eng';
      this.languageSelectControl.setValue(null, {emitEvent: false}); // Reset dropdown without triggering change listener
      this.isLoadingParallel = false; // Ensure parallel loader is off
      this.cdRef.markForCheck();
      this.scheduleChapterOffsetMeasurement(); // Remeasure layout
      this.updateScrollState(); // Update scroll state based on base content
    }
  }

  setDisplayMode(mode: 'eng-ukr' | 'eng' | 'ukr'): void {
    if (this.isParallelViewActive && this.displayMode !== mode) {
      console.log("Setting display mode to:", mode);
      this.displayMode = mode;
      // No need to reload content, just trigger redraw via pipe
      // Content height *might* change slightly if hiding one language affects wrapping
      this.scheduleChapterOffsetMeasurement(); // Remeasure is safer
      this.cdRef.markForCheck();
    } else if (!this.isParallelViewActive) {
      console.warn("Cannot change display mode when not in parallel view.");
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
    // Ensure content div exists and we are not loading
    // Use optional chaining for safety
    const contentElement = this.readerContentRef?.nativeElement;
    if (!contentElement || this.isLoading) {
      // Add a log if the element isn't ready yet
      if (!contentElement) console.warn("measureChapterOffsets: readerContentRef.nativeElement is not available yet.");
      return; // Exit if element isn't ready
    }

    console.log("Measuring chapter offsets from rendered HTML...");
    this.chapterNav = [];

    // --- CORRECTED SELECTOR ---
    // Query for anchor tags whose ID starts with "chap" (adjust prefix if needed)
    // Ensure they are within the reader content to avoid selecting other anchors
    const chapterAnchors = contentElement.querySelectorAll('a[id^="chap"]');

    console.log(`Found ${chapterAnchors.length} potential chapter anchors.`); // Add log

    chapterAnchors.forEach((anchor: Element) => {
      const elementId = anchor.id;
      // Find the parent H2 element to get the title and the correct offsetTop target
      const headingElement = anchor.closest('h2') as HTMLElement | null; // Find nearest parent h2

      if (headingElement && elementId) {
        // Get the offsetTop of the HEADING element, not the empty anchor
        const offsetTopRelativeToWrapper = headingElement.offsetTop;
        // Get a cleaner title from the heading's textContent
        const title = headingElement.textContent?.replace(/\s+/g, ' ').trim() || `Chapter (ID: ${elementId})`;

        this.chapterNav.push({
          title: title,
          offsetTop: offsetTopRelativeToWrapper,
          elementId: elementId // Store the ANCHOR's ID for selection/jumping
        });

      } else {
        if (!headingElement) console.warn(`Could not find parent H2 for anchor with ID: ${elementId}`);
        else console.warn("Found chapter anchor without ID:", anchor);
      }
    });

    // Sort by position remains important
    this.chapterNav.sort((a, b) => a.offsetTop - b.offsetTop);
    console.log(`Found and measured ${this.chapterNav.length} valid chapters.`);
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
      this.measureChapterOffsets();
      this.updateScrollState();
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
}
