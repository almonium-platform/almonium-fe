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
import {FormsModule} from '@angular/forms';
import {TuiAlertService} from '@taiga-ui/core';
import {Subject} from 'rxjs';
import {debounceTime, distinctUntilChanged, takeUntil} from 'rxjs/operators';
import {SharedLucideIconsModule} from "../../../shared/shared-lucide-icons.module";
import {ButtonComponent} from "../../../shared/button/button.component";
import {TuiSliderComponent} from "@taiga-ui/kit";
import {ActivatedRoute, Router} from "@angular/router";
import {BookMini} from "../book.model";

@Component({
  selector: 'app-reader',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedLucideIconsModule, ButtonComponent, TuiSliderComponent],
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

  private parallelVersions: BookMini[] = [];

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
              this.parallelVersions = book.availableLanguages;
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
      },
      error: (error) => {
        const message = error?.error?.message || 'An unknown error occurred.';
        this.handleError(message);
      },
    });
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


  // --- Navigation ---
  protected nextPage(): void {
    if (this.isLoading) return;
    if (this.scrollingMode) {
      const newTopIndex = this.topVisibleLineIndex + this.linesPerPage;
      // Ensure scrolling doesn't go *past* the point where the *last line* is visible
      // A stricter limit might be needed if viewportLineCapacity < linesPerPage
      const maxTopIndex = Math.max(0, this.lines.length - this.viewportLineCapacity); // Stop when last viewport full of lines is shown
      // Or simply: const maxTopIndex = Math.max(0, this.lines.length - 1); // Allow scrolling until last line is at the top
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
    if (this.isLoading) return;
    if (this.scrollingMode) {
      const newTopIndex = this.topVisibleLineIndex - this.linesPerPage;
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
}
