import {
  Component,
  OnInit,
  ElementRef,
  ViewChild,
  HostListener,
  AfterViewInit,
  ChangeDetectorRef,
  OnDestroy,
  inject,
  Renderer2 // Import Renderer2 for listening to scroll events
} from '@angular/core';
import {ReadService} from '../read.service';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {TuiAlertService} from '@taiga-ui/core';
import {Subject, Subscription, fromEvent} from 'rxjs'; // Import fromEvent
import {debounceTime, takeUntil, distinctUntilChanged, filter, tap} from 'rxjs/operators';

@Component({
  selector: 'app-reader',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reader.component.html',
  styleUrls: ['./reader.component.less'],
})
export class ReaderComponent implements OnInit, AfterViewInit, OnDestroy {
  // --- Injected Services ---
  private readService = inject(ReadService);
  private alertService = inject(TuiAlertService);
  private cdRef = inject(ChangeDetectorRef);
  private renderer = inject(Renderer2); // Inject Renderer2

  // --- Element References ---
  @ViewChild('readerContainer') readerContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('readerContentWrapper') readerContentWrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('readerContent') readerContentRef!: ElementRef<HTMLDivElement>;
  @ViewChild('paginationControls') paginationControlsRef!: ElementRef<HTMLDivElement>; // Assume it's always there now

  // --- State Properties ---
  protected text: string = '';
  private fullText: string = '';
  protected lines: string[] = [];
  protected isLoading: boolean = true;
  protected errorMessage: string | null = null;

  protected currentPage: number = 1;
  protected totalPages: number = 1; // Total pages in PAGED mode
  private linesPerPage: number = 10;
  private calculationNeeded: boolean = true; // For paged mode calculations
  protected scrollingMode: boolean = false;
  private pageHeightEstimate: number = 0; // Estimated height of a page for scroll tracking
  private isUpdatingSliderFromScroll = false; // Flag to prevent feedback loop
  private isUpdatingScrollFromPageChange = false; // Flag to prevent feedback loop


  // --- RxJS Subjects and Subscriptions ---
  private resizeSubject = new Subject<void>();
  private sliderValueSubject = new Subject<number>();
  private scrollSubscription?: Subscription;
  private destroy$ = new Subject<void>();

  // --- Constants ---
  private readonly RESIZE_DEBOUNCE_TIME = 250;
  private readonly SLIDER_DEBOUNCE_TIME = 150;
  private readonly SCROLL_DEBOUNCE_TIME = 100; // Debounce scroll events


  // --- Lifecycle Hooks ---

  ngOnInit(): void {
    this.loadBook();
    this.setupResizeListener();
    this.setupSliderListener();
  }

  ngAfterViewInit(): void {
    // Delay initial calculation slightly
    setTimeout(() => {
      if (!this.isLoading && this.lines.length > 0) {
        console.log("ngAfterViewInit: Triggering initial calculation/display.");
        this.updateDisplay(this.scrollingMode ? 1 : this.currentPage); // Recalc/display based on mode
        this.setupScrollListener(); // Setup scroll listener AFTER view init
      } else {
        console.log("ngAfterViewInit: Waiting for book load or no lines.");
      }
    }, 50); // Slightly longer delay might help ensure layout stability
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.scrollSubscription?.unsubscribe(); // Clean up scroll listener
  }

  // --- Event Listeners ---

  @HostListener('window:resize')
  onWindowResize(): void {
    this.resizeSubject.next();
  }

  // --- Core Logic ---

  private setupResizeListener(): void {
    this.resizeSubject
      .pipe(
        debounceTime(this.RESIZE_DEBOUNCE_TIME),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        console.log('Window resized...');
        // Always mark calculation as needed on resize, will only apply to paged mode
        this.calculationNeeded = true;
        this.updateDisplay(this.currentPage); // Update display, recalculates if needed
        // No need for manual cdRef.detectChanges() here typically
      });
  }

  private setupSliderListener(): void {
    this.sliderValueSubject.pipe(
      debounceTime(this.SLIDER_DEBOUNCE_TIME),
      distinctUntilChanged(),
      filter(() => !this.scrollingMode), // Only process slider input if NOT scrolling
      takeUntil(this.destroy$)
    ).subscribe(page => {
      console.log(`Slider debounced value: ${page}`);
      this.goToPage(page);
    });
  }

  private setupScrollListener(): void {
    if (this.scrollSubscription) {
      this.scrollSubscription.unsubscribe(); // Unsubscribe previous listener if any
    }
    if (this.readerContentWrapperRef) {
      console.log("Setting up scroll listener on wrapper.");
      this.scrollSubscription = fromEvent(this.readerContentWrapperRef.nativeElement, 'scroll')
        .pipe(
          debounceTime(this.SCROLL_DEBOUNCE_TIME),
          filter(() => this.scrollingMode && !this.isUpdatingScrollFromPageChange), // Only process if scrolling and not triggered by code
          takeUntil(this.destroy$)
        )
        .subscribe(() => {
          this.updatePageFromScroll();
        });
    } else {
      console.warn("Cannot set up scroll listener: readerContentWrapperRef not ready.");
      // Retry after a short delay?
      setTimeout(() => this.setupScrollListener(), 200);
    }
  }

  protected onSliderInput(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!this.scrollingMode) { // Only push if not scrolling
      this.sliderValueSubject.next(value);
    }
  }

  protected onSliderChange(event: Event): void {
    // This could be used for analytics or specific actions on release if needed
    // Currently handled by the debounced input event.
  }

  private loadBook(): void {
    const bookId = 1;
    this.isLoading = true;
    this.errorMessage = null;
    this.text = '';
    this.lines = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.calculationNeeded = true;

    this.readService.loadBook(bookId).subscribe({
      next: (response) => {
        if (response.status === 200 && response.body) {
          this.fullText = this.arrayBufferToString(response.body);
          this.lines = this.fullText.split('\n');
          this.isLoading = false;
          this.calculationNeeded = true; // Mark for calc on first display

          // Use setTimeout to ensure this runs after the current stack, allowing ngAfterViewInit potentially
          setTimeout(() => {
            this.updateDisplay(1); // Update display, which will calculate if needed
            if (!this.scrollSubscription && this.readerContentWrapperRef) {
              this.setupScrollListener(); // Setup listener if not already done
            }
          }, 0);

        } else {
          this.handleError(`Failed to load book. Status: ${response.status}`);
        }
      },
      error: (error) => {
        const message = error?.error?.message || 'An unknown error occurred.';
        this.handleError(message);
        this.alertService.open(message, {appearance: 'error'}).subscribe();
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
    this.cdRef.detectChanges();
  }

  // --- Main Display Logic (Handles Both Modes) ---

  private updateDisplay(targetPage: number): void {
    if (this.isLoading || !this.lines.length || !this.readerContainerRef || !this.readerContentRef || !this.paginationControlsRef) {
      console.warn("updateDisplay skipped: Component not ready or no content/refs.");
      // Retry might be needed if refs aren't ready
      if (!this.isLoading && this.lines.length > 0 && (!this.readerContainerRef || !this.paginationControlsRef)) {
        console.log("Retrying updateDisplay shortly...");
        setTimeout(() => this.updateDisplay(targetPage), 100);
      }
      return;
    }

    if (this.scrollingMode) {
      this.displayScrollingContent();
    } else {
      this.displayPagedContent(targetPage);
    }
    // Ensure view updates after potential changes
    this.cdRef.detectChanges();
  }

  private displayScrollingContent(): void {
    console.log("Displaying in Scrolling Mode");
    this.text = this.transformMarkdown(this.lines.join('\n'));
    // Keep totalPages from paged mode for estimates, but currentPage is dynamic
    this.calculationNeeded = false; // Calculation is irrelevant here

    // Estimate page height if needed (perhaps based on last paged calculation)
    if (this.pageHeightEstimate <= 0 && this.linesPerPage > 0 && this.readerContentWrapperRef) {
      // Rough estimate: Use wrapper height (minus buffer) or previous linesPerPage logic
      const wrapperHeight = this.readerContentWrapperRef.nativeElement.clientHeight;
      if (wrapperHeight > 0) {
        this.pageHeightEstimate = wrapperHeight * 0.95; // Use 95% as a buffer
        console.log(`Estimated page height for scroll: ${this.pageHeightEstimate}`);
      }
    }
    // Update page based on current scroll position after content renders
    setTimeout(() => this.updatePageFromScroll(), 0);
  }

  private displayPagedContent(targetPage: number): void {
    console.log(`Displaying Paged Content - Target: ${targetPage}`);
    // Ensure controls are rendered to get height BEFORE calculating available height
    this.cdRef.detectChanges();

    // Recalculate linesPerPage if needed
    if (this.calculationNeeded) {
      console.log("Recalculating Lines Per Page for Paged Mode...");
      const containerHeight = this.readerContainerRef.nativeElement.clientHeight;
      const controlsHeight = this.paginationControlsRef.nativeElement.offsetHeight;
      const availableHeight = Math.max(20, containerHeight - controlsHeight - 10); // Subtract small buffer for margin/padding
      console.log(`Paged Calc - ContainerH: ${containerHeight}, ControlsH: ${controlsHeight}, AvailableH: ${availableHeight}`);


      if (availableHeight <= 20) {
        console.warn("Paged calculation skipped: Available height is too small.");
        this.linesPerPage = 20; // Fallback
        this.totalPages = Math.max(1, Math.ceil(this.lines.length / this.linesPerPage));
        // Avoid setting calculationNeeded=false, let resize trigger recalc if layout improves
      } else {
        this.linesPerPage = this.determineLinesPerPage(availableHeight);
        if (this.linesPerPage > 0) {
          this.totalPages = Math.max(1, Math.ceil(this.lines.length / this.linesPerPage));
          // Estimate page height based on this calculation for scrolling mode later
          this.pageHeightEstimate = availableHeight; // Use the calculated available height
        } else {
          console.error("determineLinesPerPage returned 0.");
          this.linesPerPage = this.lines.length || 1;
          this.totalPages = 1;
          this.pageHeightEstimate = availableHeight; // Still estimate
        }
        this.calculationNeeded = false;
        console.log(`Paged Calculation complete: linesPerPage=${this.linesPerPage}, totalPages=${this.totalPages}, pageHeightEstimate: ${this.pageHeightEstimate}`);
      }
    }

    // Set and display the target page
    const newPage = Math.max(1, Math.min(targetPage, this.totalPages));
    if (newPage !== this.currentPage || this.text === '') { // Avoid re-rendering same page unless text is empty
      this.currentPage = newPage;
      const startIndex = (this.currentPage - 1) * this.linesPerPage;
      const endIndex = Math.min(startIndex + this.linesPerPage, this.lines.length);
      const pageLines = this.lines.slice(startIndex, endIndex);
      this.text = this.transformMarkdown(pageLines.join('\n'));
      console.log(`Displaying Page ${this.currentPage} of ${this.totalPages}`);

      // Scroll content wrapper to top when changing pages in paged mode
      if (this.readerContentWrapperRef) {
        this.readerContentWrapperRef.nativeElement.scrollTop = 0;
      }

    } else {
      console.log(`Already on page ${this.currentPage}. No content update needed.`);
    }

    // Ensure slider reflects the current page in paged mode
    // This might need adjustment if using ngModel directly causes issues
    // setTimeout(() => { if (!this.scrollingMode) { /* update slider if needed */ } }, 0);

  }

  // Binary search to find lines that fit in availableHeight
  private determineLinesPerPage(availableHeight: number): number {
    // ... (Binary search implementation remains the same as previous version)
    const contentElement = this.readerContentRef.nativeElement;
    if (!this.lines.length || availableHeight <= 0) return 1;

    let low = 1, high = this.lines.length, bestFit = 1;

    contentElement.innerHTML = ''; // Clear
    contentElement.offsetHeight; // Reflow

    // Check if all fit
    contentElement.innerHTML = this.transformMarkdown(this.lines.join('\n'));
    contentElement.offsetHeight;
    if (contentElement.scrollHeight <= availableHeight) {
      contentElement.innerHTML = '';
      return this.lines.length || 1;
    }

    // Binary search
    while (low <= high) {
      const mid = Math.floor(low + (high - low) / 2);
      if (mid === 0) break;

      const testLines = this.lines.slice(0, mid);
      contentElement.innerHTML = this.transformMarkdown(testLines.join('\n'));
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


  // --- Scroll Position Handling ---

  private updatePageFromScroll(): void {
    if (!this.scrollingMode || !this.readerContentWrapperRef || this.pageHeightEstimate <= 0) {
      return; // Only relevant in scrolling mode with valid refs/estimate
    }

    const wrapper = this.readerContentWrapperRef.nativeElement;
    const scrollTop = wrapper.scrollTop;
    const scrollHeight = wrapper.scrollHeight; // Use wrapper's scrollHeight
    const clientHeight = wrapper.clientHeight;

    // Calculate current page based on scroll position relative to estimated page height
    // Add half a clientHeight to center the "current page" logic slightly
    let calculatedPage = Math.floor((scrollTop + clientHeight / 2) / this.pageHeightEstimate) + 1;

    // Clamp page number within valid range (1 to totalPages calculated in paged mode)
    calculatedPage = Math.max(1, Math.min(calculatedPage, this.totalPages));


    if (calculatedPage !== this.currentPage) {
      console.log(`Scroll detected page change: ${this.currentPage} -> ${calculatedPage} (ScrollTop: ${scrollTop.toFixed(0)})`);
      this.isUpdatingSliderFromScroll = true; // Prevent slider feedback loop
      this.currentPage = calculatedPage;
      this.cdRef.detectChanges(); // Update the displayed page number
      // Reset flag after timeout
      setTimeout(() => this.isUpdatingSliderFromScroll = false, 0);
    }
  }

  private scrollToApproximatePage(pageNumber: number): void {
    if (!this.scrollingMode || !this.readerContentWrapperRef || this.pageHeightEstimate <= 0) {
      return;
    }
    console.log(`Scrolling to approximate page: ${pageNumber}`);
    const targetScrollTop = (pageNumber - 1) * this.pageHeightEstimate;
    const wrapper = this.readerContentWrapperRef.nativeElement;

    this.isUpdatingScrollFromPageChange = true; // Set flag before scrolling
    wrapper.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth' // Or 'auto' for instant jump
    });

    // Reset the flag after scrolling likely initiated
    // A more robust solution might involve listening for scroll end, but this is simpler
    setTimeout(() => this.isUpdatingScrollFromPageChange = false, 300); // Adjust timeout based on smooth scroll duration
  }

  // --- Navigation and Mode Toggling ---

  protected nextPage(): void {
    if (this.scrollingMode) {
      const nextPage = Math.min(this.totalPages, this.currentPage + 1);
      this.scrollToApproximatePage(nextPage);
      // updatePageFromScroll will update currentPage after scroll if needed
    } else if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }

  protected prevPage(): void {
    if (this.scrollingMode) {
      const prevPage = Math.max(1, this.currentPage - 1);
      this.scrollToApproximatePage(prevPage);
      // updatePageFromScroll will update currentPage after scroll if needed
    } else if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  // Only used directly in PAGED mode now
  protected goToPage(pageNumber: number): void {
    if (this.scrollingMode) return; // Should not be called in scroll mode

    const targetPage = Math.max(1, Math.min(pageNumber, this.totalPages));
    console.log(`goToPage (Paged): ${targetPage}`);
    this.updateDisplay(targetPage);
  }


  protected toggleScrollMode(): void {
    this.scrollingMode = !this.scrollingMode;
    console.log(`Toggled Scrolling Mode: ${this.scrollingMode}`);
    this.calculationNeeded = !this.scrollingMode; // Need calculation if switching TO paged mode

    // Reset scroll position when switching modes
    if (this.readerContentWrapperRef) {
      this.readerContentWrapperRef.nativeElement.scrollTop = 0;
    }

    // Update the display based on the new mode
    // If switching TO scrolling, go to page 1 conceptually (top)
    // If switching TO paged, stay on the currentPage we were tracking
    this.updateDisplay(this.scrollingMode ? 1 : this.currentPage);

    // Re-setup listener if needed (might have failed before if ref wasn't ready)
    if (!this.scrollSubscription) {
      this.setupScrollListener();
    }
  }

  // --- Utility ---
  private transformMarkdown(text: string): string {
    // ... (markdown transformations remain the same) ...
    return text
      .replace(/_(.*?)_/gs, '<em>$1</em>')
      .replace(/\*(.*?)\*/gs, '<strong>$1</strong>')
      .replace(/---/g, '<hr>') // Example: Horizontal rule
      .replace(/#{1,6}\s+(.*)/g, (match, p1) => { // Example: Basic Headers
        const level = match.indexOf(' ');
        return `<h${level}>${p1}</h${level}>`;
      })
      .replace(/—/g, ' — ')
      .replace(/[“”]/g, '"'); // Replace both quote types
  }

  private arrayBufferToString(buffer: ArrayBuffer): string {
    // ... (decoding remains the same) ...
    try {
      const decoder = new TextDecoder('utf-8', {fatal: true}); // Be strict about encoding
      return decoder.decode(buffer);
    } catch (e) {
      console.error("Failed to decode UTF-8, trying fallback.", e);
      // Fallback, might garble some characters if not UTF-8
      const decoder = new TextDecoder('windows-1252');
      return decoder.decode(buffer);
    }
  }
}
