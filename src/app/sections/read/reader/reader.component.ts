import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import {ReadService} from '../read.service';
import {CommonModule} from '@angular/common';
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {TuiAlertService} from '@taiga-ui/core';
import {Subject} from 'rxjs';
import {debounceTime, distinctUntilChanged, takeUntil} from 'rxjs/operators';
import {SharedLucideIconsModule} from "../../../shared/shared-lucide-icons.module";
import {ButtonComponent} from "../../../shared/button/button.component";
import {TuiDataListWrapperComponent, TuiSliderComponent} from "@taiga-ui/kit";
import {ActivatedRoute, Router} from "@angular/router";
import {BookMini} from "../book.model";
import {ParallelTranslationComponent} from "../parallel-translation/parallel-translation.component";
import {TuiSelectModule, TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {HttpResponse} from "@angular/common/http";

@Component({
  selector: 'app-reader',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedLucideIconsModule, ButtonComponent, TuiSliderComponent, ParallelTranslationComponent, TuiDataListWrapperComponent, TuiSelectModule, TuiTextfieldControllerModule, ReactiveFormsModule],
  templateUrl: './reader.component.html',
  styleUrls: ['./reader.component.less'],
})
export class ReaderComponent implements OnInit, AfterViewInit, OnDestroy {
  // --- Element References ---
  @ViewChild('readerContainer') readerContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('readerContentWrapper') readerContentWrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('readerContent') readerContentRef!: ElementRef<HTMLDivElement>;
  @ViewChild('paginationControls') paginationControlsRef!: ElementRef<HTMLDivElement>;

  // --- State Properties ---
  protected text: string = ''; // Holds the *currently rendered* HTML text
  private fullText: string = '';
  protected lines: string[] = []; // All lines of the book, including empty strings ''
  protected isLoading: boolean = true;
  protected errorMessage: string | null = null;
  protected bookId: number | null = null;

  // --- Pagination & Scrolling State ---
  protected currentPage: number = 1;
  protected totalPages: number = 1;
  private linesPerPage: number = 10; // Lines per logical page (recalculated)
  private calculationNeeded: boolean = true;
  protected scrollingMode: boolean = true;

  // --- Line-Based Scrolling State ---
  protected topVisibleLineIndex: number = 0;
  private viewportLineCapacity: number = 20; // How many lines fit visually (recalculated)
  private readonly SCROLL_LINE_STEP = 1; // Scroll one text line at a time

  // --- RxJS Subjects and Subscriptions ---
  private resizeSubject = new Subject<void>();
  private sliderValueSubject = new Subject<number>();
  private destroy$ = new Subject<void>();

  // --- Constants ---
  private readonly RESIZE_DEBOUNCE_TIME = 250;
  private readonly SLIDER_DEBOUNCE_TIME = 50;
  private readonly RENDER_DELAY_MS = 0;

  // --- Touch Scrolling State ---
  private touchStartY: number | null = null; // Y position where touch started
  private touchDeltaYAccumulator: number = 0; // Accumulated vertical movement since last line scroll trigger
  private singleLineHeightEstimate: number = 20; // Estimated height of a single line (will be updated)
  private readonly TOUCH_SCROLL_THRESHOLD_FACTOR = 0.8; // How much of a line height triggers a scroll (adjust sensitivity)

  // --- Press and Hold Scrolling State ---
  private scrollIntervalId: ReturnType<typeof setInterval> | null = null;
  private scrollHoldTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isHoldingForScroll: boolean = false; // Flag to differentiate click from hold end
  private readonly SCROLL_HOLD_DELAY = 350; // ms: Time to hold before continuous scroll starts
  private readonly SCROLL_INTERVAL_DELAY = 50; // ms: Speed of continuous scroll steps

  protected parallelVersions: BookMini[] = [];
  protected languageSelectControl = new FormControl("👆");
  protected parallelInactive: boolean = true;
  protected parallelTranslations: Map<string, string> | null = null; // To store parsed parallel data

  constructor(
    private cdRef: ChangeDetectorRef,
    private readService: ReadService,
    private alertService: TuiAlertService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
  }

  ngOnInit(): void {
    this.setupResizeListener();
    this.setupSliderListener();
    this.route.params.subscribe(params => {
      const bookId = params['id'];
      this.bookId = bookId;
      if (bookId) {
        this.loadBook(bookId);
        this.readService.getBookById(bookId, 'EN').subscribe({
          next: (book) => {
            if (book) {
              console.log(JSON.stringify(book));
              this.parallelVersions = book.availableLanguages.filter(t => t.language !== book.language);
            }
          },
          error: (error) => {
            console.error('Error fetching book details:', error);
          }
        });
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (!this.isLoading && this.lines.length > 0) {
        console.log("ngAfterViewInit: Triggering initial display calculation.");
        this.calculationNeeded = true;
        this.updateDisplay(1);
      } else {
        console.log("ngAfterViewInit: Waiting for book load or no lines.");
      }
    }, 50);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearScrollHoldTimers();
  }

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
    if (!this.scrollingMode) {
      // If not in scrolling mode, treat as a normal click (handled by click event)
      return;
    }

    // Prevent multiple timeouts if events fire rapidly
    this.clearScrollHoldTimers();
    this.isHoldingForScroll = false; // Reset flag

    this.scrollHoldTimeoutId = setTimeout(() => {
      this.isHoldingForScroll = true; // Mark that hold delay passed
      this.scrollIntervalId = setInterval(() => {
        this.performScrollStep(direction);
      }, this.SCROLL_INTERVAL_DELAY);
      // Optional: Immediately perform one step when interval starts
      // this.performScrollStep(direction);
    }, this.SCROLL_HOLD_DELAY);
  }

  protected stopScrollHold(triggerAction: 'prev' | 'next'): void {
    // If a hold scroll wasn't active (timeout didn't finish OR interval wasn't set)
    // AND we are *not* currently flagged as having held, perform the standard page turn action.
    const wasHoldScrollActive = this.isHoldingForScroll;

    this.clearScrollHoldTimers(); // Always clear timers/intervals on release

    if (!wasHoldScrollActive && this.scrollingMode) {
      // It was a click, not a hold that initiated scrolling
      console.log("Hold released before scroll started - performing single page action.");
      if (triggerAction === 'prev') {
        this.prevPage(); // Call original single-page jump logic
      } else {
        this.nextPage(); // Call original single-page jump logic
      }
    } else if (!wasHoldScrollActive && !this.scrollingMode) {
      // Handle click in paged mode (standard behaviour)
      if (triggerAction === 'prev') {
        this.prevPage();
      } else {
        this.nextPage();
      }
    } else {
      // Hold scroll was active, just stop.
      console.log("Hold scroll stopped.");
    }
  }

  private performScrollStep(direction: 'prev' | 'next'): void {
    if (!this.scrollingMode || this.isLoading || !this.lines.length) {
      this.clearScrollHoldTimers(); // Stop if mode changes or loading starts
      return;
    }

    const currentTopIndex = this.topVisibleLineIndex;
    let newTopIndex: number;

    if (direction === 'prev') {
      newTopIndex = currentTopIndex - this.SCROLL_LINE_STEP;
    } else { // direction === 'next'
      newTopIndex = currentTopIndex + this.SCROLL_LINE_STEP;
    }

    // Clamp the index
    const maxTopIndex = Math.max(0, this.lines.length - 1); // Allow scrolling until last line is at the top
    const clampedTopIndex = Math.max(0, Math.min(newTopIndex, maxTopIndex));

    if (clampedTopIndex !== this.topVisibleLineIndex) {
      this.topVisibleLineIndex = clampedTopIndex;
      this.updatePageNumberFromTopIndex();
      this.renderVisibleLines();
      this.cdRef.detectChanges(); // Update slider and page number display

      // Optional: Stop automatically if boundary reached
      // if ((direction === 'prev' && clampedTopIndex === 0) ||
      //     (direction === 'next' && clampedTopIndex === maxTopIndex)) {
      //   this.clearScrollHoldTimers();
      // }

    } else {
      // Reached the beginning or end, stop the interval
      this.clearScrollHoldTimers();
      console.log("Scroll boundary reached, stopping hold scroll.");
    }
  }

  // --- Event Listeners ---
  @HostListener('window:resize')
  onWindowResize(): void {
    this.resizeSubject.next();
  }

  onWheelScroll(event: WheelEvent): void {
    if (!this.scrollingMode || this.isLoading || !this.lines.length) {
      return;
    }
    event.preventDefault();
    const delta = Math.sign(event.deltaY);
    const newTopIndex = this.topVisibleLineIndex + (delta * this.SCROLL_LINE_STEP);
    const maxTopIndex = Math.max(0, this.lines.length - 1);
    const clampedTopIndex = Math.max(0, Math.min(newTopIndex, maxTopIndex));

    if (clampedTopIndex !== this.topVisibleLineIndex) {
      this.topVisibleLineIndex = clampedTopIndex;
      this.updatePageNumberFromTopIndex();
      this.renderVisibleLines();
      this.cdRef.detectChanges(); // Update slider/page number display
    }
  }

  // --- Core Logic ---
  private setupResizeListener(): void {
    this.resizeSubject.pipe(
      debounceTime(this.RESIZE_DEBOUNCE_TIME),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      console.log('Window resized...');
      this.calculationNeeded = true;
      this.updateDisplay(this.currentPage); // Use current page as target
    });
  }

  private setupSliderListener(): void {
    this.sliderValueSubject.pipe(
      debounceTime(this.SLIDER_DEBOUNCE_TIME),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(page => {
      console.log(`Slider debounced value: ${page}`);
      if (this.scrollingMode) {
        this.topVisibleLineIndex = this.getTopIndexForPage(page);
        this.currentPage = page;
        this.renderVisibleLines();
      } else {
        this.goToPage(page);
      }
    });
  }

  protected onSliderInput(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.sliderValueSubject.next(value);
  }

  protected onSliderChange(event: Event): void { /* Optional final action */
  }

  private loadBook(bookId: number): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.text = '';
    this.lines = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.topVisibleLineIndex = 0;
    this.calculationNeeded = true;
    this.cdRef.detectChanges();

    this.readService.loadBook(bookId).subscribe({
      next: (response) => {
        this.handleByteResponse(response);
      },
      error: (error) => {
        const message = error?.error?.message || 'An unknown error occurred.';
        this.handleError(message);
      },
    });
  }

  private handleByteResponse(response: HttpResponse<ArrayBuffer>) {
    if (response.status === 200 && response.body) {
      this.fullText = this.arrayBufferToString(response.body);
      // *** FIX: Keep empty strings by removing .map() ***
      this.lines = this.fullText.split('\n');
      // console.log('Lines loaded:', this.lines.slice(0, 20)); // Debug: Check if '' are present
      this.isLoading = false;
      this.calculationNeeded = true;
      this.errorMessage = null;

      setTimeout(() => {
        this.updateDisplay(1);
      }, this.RENDER_DELAY_MS);

    } else {
      this.handleError(`Failed to load book. Status: ${response.status}`);
    }
  }

  private handleError(message: string): void {
    console.error("Reader Error:", message);
    this.errorMessage = message;
    this.isLoading = false;
    this.text = '';
    this.lines = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.topVisibleLineIndex = 0;
    this.cdRef.detectChanges();
  }

  // --- Main Display Logic ---
  private updateDisplay(targetPageOrCurrentPage: number): void {
    if (this.isLoading || !this.lines.length) {
      console.warn("updateDisplay skipped: Component not ready or no content.");
      return;
    }
    if (!this.readerContainerRef || !this.readerContentRef || !this.paginationControlsRef) {
      console.warn("updateDisplay skipped: Essential refs not available. Retrying...");
      setTimeout(() => this.updateDisplay(targetPageOrCurrentPage), 100);
      return;
    }

    console.log(`updateDisplay called. Mode: ${this.scrollingMode ? 'Scroll' : 'Paged'}. Target/Current Page: ${targetPageOrCurrentPage}`);

    if (this.calculationNeeded) {
      this.recalculateLayout();
      if (this.totalPages === 0) {
        console.error("Layout calculation failed, cannot proceed.");
        this.handleError("Failed to calculate reader layout.");
        return;
      }
    }

    if (this.scrollingMode) {
      // Ensure target page is valid *before* getting top index
      const safeTargetPage = Math.max(1, Math.min(targetPageOrCurrentPage, this.totalPages));
      this.topVisibleLineIndex = this.getTopIndexForPage(safeTargetPage);
      this.currentPage = safeTargetPage; // Sync page number
      console.log(`  Scroll Mode: Rendering from line index ${this.topVisibleLineIndex} (Page ${this.currentPage})`);
      this.renderVisibleLines();
    } else {
      const safeTargetPage = Math.max(1, Math.min(targetPageOrCurrentPage, this.totalPages));
      console.log(`  Paged Mode: Rendering page ${safeTargetPage}`);
      this.displayPagedContent(safeTargetPage);
    }
  }

  // --- Unified Layout Calculation ---
  private recalculateLayout(): void {
    console.log("Recalculating Layout (Paged & Scroll)...");
    if (!this.readerContainerRef || !this.paginationControlsRef || !this.readerContentRef || !this.readerContentWrapperRef || !this.lines.length) {
      console.error("Cannot calculate layout - missing refs or no lines.");
      this.totalPages = 1;
      this.linesPerPage = 10;
      this.viewportLineCapacity = 10;
      this.calculationNeeded = false;
      return;
    }

    const containerHeight = this.readerContainerRef.nativeElement.clientHeight;
    let controlsHeight = this.paginationControlsRef.nativeElement.offsetHeight;
    if (controlsHeight <= 0) controlsHeight = 40; // Estimate if needed

    // Adjust available height calculation based on actual container padding/margins
    const readerContainerPaddingTop = parseFloat(getComputedStyle(this.readerContainerRef.nativeElement).paddingTop) || 0;
    const readerContainerPaddingBottom = parseFloat(getComputedStyle(this.readerContainerRef.nativeElement).paddingBottom) || 0;
    const wrapperMarginBottom = parseFloat(getComputedStyle(this.readerContentWrapperRef.nativeElement).marginBottom) || 0;
    const contentPaddingTop = parseFloat(getComputedStyle(this.readerContentRef.nativeElement).paddingTop) || 0;
    const contentPaddingBottom = parseFloat(getComputedStyle(this.readerContentRef.nativeElement).paddingBottom) || 0;

    // Height available specifically for the text lines within the content div
    const availableHeight = Math.max(20, containerHeight
      - controlsHeight
      - readerContainerPaddingTop
      - readerContainerPaddingBottom
      - wrapperMarginBottom
      - contentPaddingTop
      - contentPaddingBottom);


    console.log(`Layout Calc - ContainerH: ${containerHeight}, ControlsH: ${controlsHeight}, AvailableH (for text): ${availableHeight.toFixed(1)}`);

    if (availableHeight <= 20) {
      console.warn("Layout calculation warning: Available height is very small.");
      this.linesPerPage = 5; // Small fallback
      this.viewportLineCapacity = 5;
    } else {
      // Calculate lines per logical page
      this.linesPerPage = this.determineLinesFittingHeight(availableHeight);
      // Assume viewport capacity is the same for simplicity in line-based scroll.
      // If visual discrepancies appear (e.g., scroll jumps too far/short),
      // this might need a separate calculation based on average line height.
      this.viewportLineCapacity = this.linesPerPage;
      console.log(`Layout Calc - Lines Per Page: ${this.linesPerPage}, Viewport Capacity: ${this.viewportLineCapacity}`);
    }

    this.totalPages = Math.max(1, Math.ceil(this.lines.length / (this.linesPerPage || 1)));
    this.calculationNeeded = false;

    console.log(`Layout Calculation complete: linesPerPage=${this.linesPerPage}, totalPages=${this.totalPages}, viewportLineCapacity=${this.viewportLineCapacity}`);
  }

  // Modify determineLinesFittingHeight to store the estimate
  private determineLinesFittingHeight(availableHeight: number): number {
    const contentElement = this.readerContentRef.nativeElement;
    const sampleLine = this.lines.find(line => line.trim() !== '') || 'A';
    if (!this.lines.length || availableHeight <= 0) return 1;

    contentElement.innerHTML = '';
    contentElement.offsetHeight;

    contentElement.innerHTML = this.transformMarkdown(sampleLine || ' ');
    contentElement.offsetHeight;
    const measuredSingleLineHeight = contentElement.scrollHeight;

    // *** STORE the estimate ***
    if (measuredSingleLineHeight > 0) {
      this.singleLineHeightEstimate = measuredSingleLineHeight;
      console.log(`  Single line height estimated: ${this.singleLineHeightEstimate.toFixed(1)}px`);
    } else {
      // Fallback estimate if measurement fails
      const fontSize = 20;
      const lineHeight = 1.6;
      this.singleLineHeightEstimate = fontSize * lineHeight;
      console.warn(`Single line height measured as 0. Using fallback estimate: ${this.singleLineHeightEstimate}px`);
    }
    // *** END Store ***


    if (this.singleLineHeightEstimate > availableHeight) {
      console.warn(`Single line height (${this.singleLineHeightEstimate}px) exceeds available height (${availableHeight}px). Returning 1 line.`);
      contentElement.innerHTML = '';
      return 1;
    }

    // Optimization: Check if all lines fit
    const testAllText = this.lines.map(l => l || ' ').join('\n');
    contentElement.innerHTML = this.transformMarkdown(testAllText);
    contentElement.offsetHeight;
    if (contentElement.scrollHeight <= availableHeight) {
      contentElement.innerHTML = '';
      return this.lines.length || 1;
    }

    // Estimate upper bound
    let low = 1;
    // Use the stored estimate for the upper bound calculation
    let high = Math.min(this.lines.length, Math.ceil(availableHeight / this.singleLineHeightEstimate) + 5);
    let bestFit = 1;

    // Binary search
    while (low <= high) {
      const mid = Math.floor(low + (high - low) / 2);
      if (mid === 0) break;

      const testLines = this.lines.slice(0, mid);
      const testText = testLines.map(l => l || ' ').join('\n');
      contentElement.innerHTML = this.transformMarkdown(testText);
      contentElement.offsetHeight;
      const measuredHeight = contentElement.scrollHeight;

      if (measuredHeight <= availableHeight) {
        bestFit = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    contentElement.innerHTML = '';
    return Math.max(1, bestFit);
  }

  // --- Paged Content Rendering ---
  private displayPagedContent(targetPage: number): void {
    if (this.calculationNeeded) {
      console.warn("displayPagedContent called while calculationNeeded is true. Recalculating...");
      this.recalculateLayout();
    }

    const newPage = Math.max(1, Math.min(targetPage, this.totalPages));
    const startIndex = (newPage - 1) * this.linesPerPage;
    const endIndex = Math.min(startIndex + this.linesPerPage, this.lines.length);
    const pageLines = this.lines.slice(startIndex, endIndex);
    // Join lines with '\n', transformMarkdown will handle basics, CSS handles rendering
    const rawText = pageLines.join('\n');
    const newHtml = this.transformMarkdown(rawText);

    console.log(`Paged Render - Page: ${newPage}, Lines: ${startIndex}-${endIndex - 1}`);

    this.currentPage = newPage;
    this.text = newHtml; // Update text to be rendered (HTML)

    if (this.readerContentWrapperRef) {
      this.readerContentWrapperRef.nativeElement.scrollTop = 0;
    }
    this.cdRef.detectChanges();
  }

  // --- Scrolling Content Rendering ---
  private renderVisibleLines(): void {
    if (this.calculationNeeded) {
      console.warn("renderVisibleLines called while calculationNeeded is true. Recalculating...");
      this.recalculateLayout();
    }

    const startIndex = Math.max(0, this.topVisibleLineIndex);
    // Render enough lines to fill the viewport + buffer
    const renderCount = this.viewportLineCapacity + 10; // Increased buffer slightly
    const endIndex = Math.min(startIndex + renderCount, this.lines.length);
    const visibleLines = this.lines.slice(startIndex, endIndex);
    const rawText = visibleLines.join('\n');
    const newHtml = this.transformMarkdown(rawText);

    // console.log(`Scroll Render - TopIdx: ${startIndex}, Count: ${renderCount}, Lines: ${startIndex}-${endIndex - 1}`);

    this.text = newHtml; // Update text to be rendered (HTML)
    this.cdRef.detectChanges();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // 1. Ignore key presses if the component is loading
    if (this.isLoading) {
      return;
    }

    // 2. Ignore key presses if the event originates from an input, select, or textarea
    const target = event.target as HTMLElement;
    const targetTagName = target?.tagName?.toUpperCase();
    if (targetTagName === 'INPUT' || targetTagName === 'SELECT' || targetTagName === 'TEXTAREA') {
      // User is likely typing in a form control, don't interfere
      return;
    }

    // 3. Handle specific keys
    switch (event.key) { // 'key' is generally preferred over keyCode
      case 'ArrowLeft':
        event.preventDefault(); // Prevent default browser behavior (like scrolling the page)
        console.log("Arrow Left detected - Triggering Previous Action");
        this.prevPage(); // Call the existing prevPage logic
        break;

      case 'ArrowRight':
        event.preventDefault(); // Prevent default browser behavior
        console.log("Arrow Right detected - Triggering Next Action");
        this.nextPage(); // Call the existing nextPage logic
        break;

      case 'ArrowUp':
        if (this.scrollingMode) {
          event.preventDefault();
          this.performScrollStep('prev'); // Use the fine-grained scroll step
        }
        break;
      case 'ArrowDown':
        if (this.scrollingMode) {
          event.preventDefault();
          this.performScrollStep('next'); // Use the fine-grained scroll step
        }
        break;
    }
  }

  // --- Navigation ---
  protected nextPage(): void {
    // This logic is now primarily for PAGED mode or a quick CLICK in SCROLL mode
    if (this.isLoading) return;
    if (this.scrollingMode) {
      // Perform a *viewport* jump on a quick click
      const scrollStep = this.viewportLineCapacity > 0 ? this.viewportLineCapacity : 1;
      const newTopIndex = this.topVisibleLineIndex + scrollStep;
      const maxTopIndex = Math.max(0, this.lines.length - this.viewportLineCapacity);
      this.topVisibleLineIndex = Math.min(newTopIndex, maxTopIndex);
      this.updatePageNumberFromTopIndex();
      this.renderVisibleLines();
      this.cdRef.detectChanges();
    } else {
      if (this.currentPage < this.totalPages) {
        this.goToPage(this.currentPage + 1);
      }
    }
  }

  protected prevPage(): void {
    // This logic is now primarily for PAGED mode or a quick CLICK in SCROLL mode
    if (this.isLoading) return;
    if (this.scrollingMode) {
      // Perform a *viewport* jump on a quick click
      const scrollStep = this.viewportLineCapacity > 0 ? this.viewportLineCapacity : 1;
      const newTopIndex = this.topVisibleLineIndex - scrollStep;
      this.topVisibleLineIndex = Math.max(0, newTopIndex);
      this.updatePageNumberFromTopIndex();
      this.renderVisibleLines();
      this.cdRef.detectChanges();
    } else {
      if (this.currentPage > 1) {
        this.goToPage(this.currentPage - 1);
      }
    }
  }

  private updatePageNumberFromTopIndex(): void {
    if (this.linesPerPage > 0) {
      const calculatedPage = Math.floor(this.topVisibleLineIndex / this.linesPerPage) + 1;
      this.currentPage = Math.max(1, Math.min(calculatedPage, this.totalPages));
    } else {
      this.currentPage = 1;
    }
  }

  private getTopIndexForPage(pageNumber: number): number {
    const targetPage = Math.max(1, Math.min(pageNumber, this.totalPages));
    const index = (targetPage - 1) * this.linesPerPage;
    // Allow index to reach the very end if needed
    return Math.max(0, Math.min(index, this.lines.length > 0 ? this.lines.length - 1 : 0));
  }


  protected goToPage(pageNumber: number): void {
    if (this.scrollingMode) {
      console.warn("goToPage called directly in scrolling mode - using slider logic.");
      this.sliderValueSubject.next(pageNumber);
      return;
    }
    if (this.isLoading || this.calculationNeeded) {
      console.warn("goToPage skipped: loading or calculation needed.");
      return;
    }
    const targetPage = Math.max(1, Math.min(pageNumber, this.totalPages || 1));
    if (targetPage !== this.currentPage) {
      this.displayPagedContent(targetPage);
    }
  }

  // --- Mode Toggle ---
  protected toggleScrollMode(): void {
    if (this.isLoading) return;

    const pageBeforeToggle = this.currentPage;
    const topIndexBeforeToggle = this.topVisibleLineIndex;

    this.scrollingMode = !this.scrollingMode;
    console.log(`Toggled Scrolling Mode: ${this.scrollingMode}.`);

    this.calculationNeeded = true; // Recalculate layout needed

    // Use setTimeout to ensure DOM updates (like class changes) apply
    // before recalculation and rendering for the new mode.
    setTimeout(() => {
      if (this.scrollingMode) {
        // --- Switched Paged -> Scroll ---
        this.recalculateLayout(); // Recalc with new mode active
        this.topVisibleLineIndex = this.getTopIndexForPage(pageBeforeToggle);
        this.updatePageNumberFromTopIndex(); // Ensure currentPage is correct
        console.log(`  Switching P->S: Was on P ${pageBeforeToggle}, setting top index to ${this.topVisibleLineIndex}, calculated page ${this.currentPage}`);
        this.renderVisibleLines();
      } else {
        // --- Switched Scroll -> Paged ---
        let targetPage: number;
        if (this.linesPerPage > 0) { // Use linesPerPage from *before* recalc potentially
          targetPage = Math.floor(topIndexBeforeToggle / this.linesPerPage) + 1;
        } else {
          targetPage = 1;
        }

        this.recalculateLayout(); // Recalc with new mode active
        targetPage = Math.max(1, Math.min(targetPage, this.totalPages)); // Clamp with new totalPages

        console.log(`  Switching S->P: Was at top index ${topIndexBeforeToggle}, targeting page ${targetPage}`);
        this.displayPagedContent(targetPage);
      }
    }, 0); // Execute after current cycle
  }


  // --- Utilities ---
  // *** FIX: Use simpler markdown transform relying on \n and white-space: pre-line ***
  private transformMarkdown(text: string): string {
    if (!text && text !== '') return ''; // Handle null/undefined but allow empty string

    // Basic transformations - operates on the joined string block.
    // IMPORTANT: This relies on the CSS rule `white-space: pre-line;` on the
    // `.reader-content` element to correctly handle the `\n` characters
    // for line breaks (including preserving blank lines).
    return text
      // Escape HTML to prevent potential XSS from input text before applying markdown
      .replace(/</g, '<')
      .replace(/>/g, '>')
      // Apply markdown-like styling *after* escaping
      .replace(/_(.*?)_/gs, '<em>$1</em>')        // Italic
      .replace(/\*(.*?)\*/gs, '<strong>$1</strong>') // Bold (use * instead of **)
      .replace(/—/g, ' — ')                   // Em dash
    // No need to handle \n here, CSS `white-space: pre-line` does that.
  }


  private arrayBufferToString(buffer: ArrayBuffer): string {
    try {
      const decoder = new TextDecoder('utf-8', {fatal: true});
      return decoder.decode(buffer);
    } catch (e) {
      console.warn("UTF-8 decoding failed, trying windows-1252.", e);
      const decoder = new TextDecoder('windows-1252');
      return decoder.decode(buffer);
    }
  }

  protected onTouchStart(event: TouchEvent): void {
    if (!this.scrollingMode || this.isLoading || event.touches.length !== 1) {
      // Only handle single touches in scrolling mode
      this.touchStartY = null; // Reset if conditions not met
      return;
    }
    // event.preventDefault(); // Prevent default only on move if scrolling happens
    this.touchStartY = event.touches[0].clientY;
    this.touchDeltaYAccumulator = 0; // Reset accumulator on new touch
    // console.log('Touch Start Y:', this.touchStartY);
  }

  protected onTouchMove(event: TouchEvent): void {
    if (!this.scrollingMode || this.isLoading || this.touchStartY === null || event.touches.length !== 1) {
      return; // Not scrolling, not started, or multi-touch
    }

    const currentY = event.touches[0].clientY;
    const deltaSinceStart = currentY - this.touchStartY; // Positive = swipe down, Negative = swipe up

    // Calculate movement since the *last* accumulator check or start
    // This represents the raw pixel movement to consider for triggering scrolls
    const movement = -deltaSinceStart; // Invert: positive = scroll down (content up), negative = scroll up (content down)

    // Add this movement fraction to the accumulator
    this.touchDeltaYAccumulator = movement; // Simpler: just track total movement since start

    const scrollThreshold = this.singleLineHeightEstimate * this.TOUCH_SCROLL_THRESHOLD_FACTOR;

    if (scrollThreshold <= 0) {
      console.warn("Scroll threshold is zero or negative, cannot process touch move.");
      return; // Avoid division by zero or infinite loops
    }

    // How many lines worth of movement have we accumulated?
    const linesToScroll = Math.trunc(this.touchDeltaYAccumulator / scrollThreshold);

    if (linesToScroll !== 0) {
      // We have crossed a threshold, trigger scroll
      event.preventDefault(); // Prevent browser scrolling *only when we actually scroll*

      const linesMoved = linesToScroll * this.SCROLL_LINE_STEP; // Apply step multiplier if needed
      const newTopIndex = this.topVisibleLineIndex + linesMoved;

      // Clamp the index
      const maxTopIndex = Math.max(0, this.lines.length - 1); // Can scroll until the last line is at the top
      const clampedTopIndex = Math.max(0, Math.min(newTopIndex, maxTopIndex));

      if (clampedTopIndex !== this.topVisibleLineIndex) {
        // console.log(`Touch Scroll: Acc ${this.touchDeltaYAccumulator.toFixed(0)}, Threshold ${scrollThreshold.toFixed(0)}, Lines ${linesToScroll}, New Index ${clampedTopIndex}`);
        this.topVisibleLineIndex = clampedTopIndex;
        this.updatePageNumberFromTopIndex();
        this.renderVisibleLines();
        this.cdRef.detectChanges(); // Update slider and page number display
      }

      // --- CRITICAL: Adjust accumulator and start point ---
      // Subtract the scrolled amount (in pixels) from the accumulator
      this.touchDeltaYAccumulator -= linesToScroll * scrollThreshold;
      // Update the "effective" start Y for the next delta calculation
      // This prevents runaway scrolling if the finger pauses after crossing a threshold.
      this.touchStartY = currentY - (this.touchDeltaYAccumulator / -1); // Re-calculate start based on remaining accumulator
    }
    // No else needed, if threshold isn't met, accumulator keeps building
  }

  protected onTouchEnd(event: TouchEvent): void {
    if (!this.scrollingMode) return;
    // Reset tracking state when touch ends
    this.touchStartY = null;
    this.touchDeltaYAccumulator = 0;
    // console.log('Touch End');
  }

  protected onTouchCancel(event: TouchEvent): void {
    // Same as touch end - reset state
    this.onTouchEnd(event);
    // console.log('Touch Cancel');
  }

  goBack() {
    // change - go back to the book details, not the list
    this.router.navigate(['/read']).then(() => {
    }).catch((error) => {
      console.error('Navigation error:', error);
      this.alertService.open('Error navigating back.', {label: 'Error', appearance: 'error',}).subscribe();
    });
  }

  protected toggleParallel() {
    this.parallelInactive = !this.parallelInactive;

    if (this.parallelInactive) {
      // --- Switched OFF Parallel Mode ---
      this.languageSelectControl.setValue("👆");
      this.parallelTranslations = null; // Clear the parsed data
      // TODO: Force a re-render of the original text if needed
      // Assuming updateDisplay will render based on this.lines which holds original
      console.log("Parallel mode OFF. Clearing translations.");
      // You might need to trigger a re-render explicitly if the view doesn't update
      // this.updateDisplay(this.currentPage); // Or just re-render current view
      // Or maybe just trigger change detection if only the display logic changes
      // this.cdRef.detectChanges();


    } else {
      // --- Switched ON Parallel Mode ---
      this.isLoading = true; // Indicate loading parallel text
      this.errorMessage = null; // Clear previous errors
      const selectedLang = this.languageSelectControl.value;

      if (!selectedLang || selectedLang === "👆") {
        this.handleError("Please select a language for parallel text.");
        this.parallelInactive = true; // Revert state
        this.isLoading = false;
        return;
      }

      this.readService.getParallelText(this.bookId!, selectedLang).subscribe({
        next: (response) => {
          // Handle the parallel text response specifically
          if (response.status === 200 && response.body) {
            const parallelFullText = this.arrayBufferToString(response.body);
            // Parse and store the result
            this.parallelTranslations = this.parseParallelText(parallelFullText);
            console.log('Parallel translations parsed and stored.');

            // --- IMPORTANT: Decide on DISPLAY ---
            // This only *parses* the data. It doesn't change how text is rendered yet.
            // You now need to modify `renderVisibleLines` and/or `displayPagedContent`
            // to LOOK UP translations in `this.parallelTranslations` for the original
            // lines being displayed and format them accordingly (e.g., interleaved HTML).
            // For now, just log it. Display logic is the next step.
            // Example: You might need to force a re-render which now uses the map.
            // this.updateDisplay(this.currentPage);


            this.isLoading = false; // Done loading parallel text
          } else {
            this.handleError(`Failed to load parallel text. Status: ${response.status}`);
            this.parallelTranslations = null; // Clear on failure
            this.parallelInactive = true; // Revert state
            this.languageSelectControl.setValue("👆");
            this.isLoading = false;
          }
        },
        error: (error) => {
          const message = error?.error?.message || 'An unknown error occurred fetching parallel text.';
          this.handleError(message);
          this.parallelTranslations = null; // Clear on failure
          this.parallelInactive = true; // Revert state on error
          this.languageSelectControl.setValue("👆");
          this.isLoading = false;
        }
      });
    }
    // Trigger change detection if you modified component state that affects the view
    this.cdRef.detectChanges();
  }

  get langs() {
    return this.parallelVersions.map(t => t.language);
  }

  private parseParallelText(parallelFullText: string): Map<string, string> {
    const parallelMap = new Map<string, string>();
    if (!parallelFullText) {
      return parallelMap; // Return empty map if input is empty
    }

    const lines = parallelFullText.split('\n');

    for (const line of lines) {
      // Skip empty lines
      if (!line.trim()) {
        continue;
      }

      const segments = line.split('|');

      // Process segments in pairs
      for (let i = 0; i < segments.length - 1; i += 2) {
        // Use optional chaining just in case split results in odd segments
        const original = segments[i]?.trim();
        const translation = segments[i + 1]?.trim();

        // Add to map only if both parts are non-empty after trimming
        if (original && translation) {
          // Decide on handling duplicates: overwrite (current) or ignore/append?
          parallelMap.set(original, translation);
        }
      }
    }
    console.log(`Parsed ${parallelMap.size} parallel entries.`);
    return parallelMap;
  }

  protected onWrapperClick(event: MouseEvent): void {
    const contentEl = this.readerContentRef.nativeElement;
    const wrapperEl = this.readerContainerRef.nativeElement;
    const control = this.paginationControlsRef.nativeElement;
    const clickedOnControls = control.contains(event.target as Node);

    if (clickedOnControls) {
      return;
    }

    const clickedInsideContent = contentEl.contains(event.target as Node);

    if (!clickedInsideContent || event.target === wrapperEl) {
      const contentRect = contentEl.getBoundingClientRect();
      const clickX = event.clientX;

      const toTheRight = clickX > contentRect.left;

      this.handleWhiteSpaceClick(toTheRight);
    }
  }

  private handleWhiteSpaceClick(toTheRight: boolean): void {
    console.log('Whitespace click. Triggering page jump.');
    if (toTheRight) {
      this.nextPage();
    } else {
      this.prevPage();
    }
  }
}
