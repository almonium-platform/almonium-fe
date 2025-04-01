import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  Renderer2,
  ViewChild
} from '@angular/core';
import {ReadService} from '../read.service';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {TuiAlertService} from '@taiga-ui/core';
import {fromEvent, Subject, Subscription} from 'rxjs';
import {debounceTime, distinctUntilChanged, filter, takeUntil} from 'rxjs/operators';

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
  private renderer = inject(Renderer2);

  // --- Element References ---
  @ViewChild('readerContainer') readerContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('readerContentWrapper') readerContentWrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('readerContent') readerContentRef!: ElementRef<HTMLDivElement>;
  @ViewChild('paginationControls') paginationControlsRef!: ElementRef<HTMLDivElement>;

  // --- State Properties ---
  protected text: string = '';
  private fullText: string = '';
  protected lines: string[] = [];
  protected isLoading: boolean = true;
  protected errorMessage: string | null = null;

  protected currentPage: number = 1;
  protected totalPages: number = 1;
  private linesPerPage: number = 10;
  private calculationNeeded: boolean = true;
  protected scrollingMode: boolean = false;
  private pageHeightEstimate: number = 0;
  private isUpdatingSliderFromScroll = false;
  private isUpdatingScrollFromPageChange = false; // Also used for slider interaction in scroll mode

  // --- RxJS Subjects and Subscriptions ---
  private resizeSubject = new Subject<void>();
  private sliderValueSubject = new Subject<number>();
  private scrollSubscription?: Subscription;
  private sliderSubscription?: Subscription; // Changed name for clarity
  private destroy$ = new Subject<void>();

  // --- Constants ---
  private readonly RESIZE_DEBOUNCE_TIME = 250;
  private readonly SLIDER_DEBOUNCE_TIME = 150;
  private readonly SCROLL_DEBOUNCE_TIME = 100;

  // --- Lifecycle Hooks ---
  ngOnInit(): void {
    this.loadBook();
    this.setupResizeListener();
    this.setupSliderListener();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (!this.isLoading && this.lines.length > 0) {
        console.log("ngAfterViewInit: Triggering initial display.");
        // Pass initial page correctly, respect existing mode if component re-inits
        this.updateDisplay(this.currentPage);
        this.setupScrollListener();
      } else {
        console.log("ngAfterViewInit: Waiting for book load or no lines.");
      }
    }, 50);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.scrollSubscription?.unsubscribe();
    this.sliderSubscription?.unsubscribe();
  }

  // --- Event Listeners ---
  @HostListener('window:resize')
  onWindowResize(): void {
    this.resizeSubject.next();
  }

  // --- Core Logic ---
  private setupResizeListener(): void {
    this.resizeSubject.pipe(
      debounceTime(this.RESIZE_DEBOUNCE_TIME),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      console.log('Window resized...');
      this.calculationNeeded = true; // Recalculate needed for paged mode
      this.updateDisplay(this.currentPage); // Update display, recalculates paged if needed
    });
  }

  // --- Slider Setup --- (Fix Bug 1)
  private setupSliderListener(): void {
    if (this.sliderSubscription) {
      this.sliderSubscription.unsubscribe();
    } // Cleanup previous if any

    this.sliderSubscription = this.sliderValueSubject.pipe(
      debounceTime(this.SLIDER_DEBOUNCE_TIME),
      distinctUntilChanged(),
      // filter(() => !this.isUpdatingSliderFromScroll), // Prevent feedback from scroll updating slider (we might need this flag)
      takeUntil(this.destroy$)
    ).subscribe(page => {
      console.log(`Slider debounced value: ${page}`);
      // Decide action based on mode
      if (this.scrollingMode) {
        // Avoid fighting scroll listener if it just updated the slider
        if (!this.isUpdatingSliderFromScroll) {
          console.log(`Slider action: Scrolling to approx page ${page}`);
          this.scrollToApproximatePage(page);
        } else {
          console.log("Slider action skipped: update likely came from scroll event");
        }
      } else {
        console.log(`Slider action: Going to paged page ${page}`);
        this.goToPage(page); // Navigate paged mode
      }
    });
  }

  // --- Scroll Setup ---
  private setupScrollListener(): void {
    if (this.scrollSubscription) {
      this.scrollSubscription.unsubscribe();
    }
    if (this.readerContentWrapperRef) {
      console.log("Setting up scroll listener on wrapper.");
      this.scrollSubscription = fromEvent(this.readerContentWrapperRef.nativeElement, 'scroll').pipe(
        debounceTime(this.SCROLL_DEBOUNCE_TIME),
        filter(() => this.scrollingMode && !this.isUpdatingScrollFromPageChange),
        takeUntil(this.destroy$)
      ).subscribe(() => {
        this.updatePageFromScroll();
      });
    } else {
      console.warn("Cannot set up scroll listener: readerContentWrapperRef not ready.");
      setTimeout(() => this.setupScrollListener(), 200);
    }
  }

  // --- Slider Input --- (Fix Bug 1)
  protected onSliderInput(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    // Always push to subject, listener decides action based on mode
    this.sliderValueSubject.next(value);
  }

  protected onSliderChange(event: Event): void { /* Optional final action */
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

  // --- Main Display Logic ---
  private updateDisplay(targetPage: number): void {
    if (this.isLoading || !this.lines.length || !this.readerContainerRef || !this.readerContentRef || !this.paginationControlsRef) {
      console.warn("updateDisplay skipped: Component not ready or no content/refs.");
      if (!this.isLoading && this.lines.length > 0 && (!this.readerContainerRef || !this.paginationControlsRef)) {
        console.log("Retrying updateDisplay shortly...");
        setTimeout(() => this.updateDisplay(targetPage), 100);
      }
      return;
    }

    console.log(`updateDisplay called for targetPage: ${targetPage}, scrollingMode: ${this.scrollingMode}`);

    if (this.scrollingMode) {
      this.displayScrollingContent(targetPage);
    } else {
      this.displayPagedContent(targetPage);
    }
    this.cdRef.detectChanges();
  }
  // --- Scrolling Content --- (Fix Bug 2)
  private displayScrollingContent(scrollToPage: number): void {
    console.log("Displaying in Scrolling Mode");
    const fullRenderedText = this.transformMarkdown(this.lines.join('\n'));
    // Only update innerHTML if it actually changed
    if (this.text !== fullRenderedText) {
      this.text = fullRenderedText;
      // We MUST wait until Angular renders this full text before scrolling
      setTimeout(() => {
        this.estimatePageHeightIfNeeded(); // Ensure estimate exists
        this.scrollToApproximatePage(scrollToPage); // Scroll to the target page
        // Update current page based on final scroll position after programmatic scroll
        setTimeout(() => this.updatePageFromScroll(), 350); // Allow smooth scroll time
      }, 0); // Execute after render cycle
    } else {
      // Text didn't change, just ensure scroll position is right
      this.estimatePageHeightIfNeeded();
      this.scrollToApproximatePage(scrollToPage);
      setTimeout(() => this.updatePageFromScroll(), 350);
    }
    this.calculationNeeded = false;
  }

  // Helper to consolidate estimation logic
  private estimatePageHeightIfNeeded(): void {
    if (this.pageHeightEstimate <= 0 && this.linesPerPage > 0 && this.readerContentWrapperRef) {
      const wrapperHeight = this.readerContentWrapperRef.nativeElement.clientHeight;
      if (wrapperHeight > 0) {
        // Use the wrapper height as the estimate (basis for paged mode calc)
        this.pageHeightEstimate = wrapperHeight;
        console.log(`Estimated page height for scroll: ${this.pageHeightEstimate}`);
      }
    } else if (this.pageHeightEstimate <= 0) {
      console.warn("Cannot estimate page height - using fallback.");
      this.pageHeightEstimate = 500; // Arbitrary fallback
    }
  }

  // --- Paged Content --- (Fix Bug 3)
  private displayPagedContent(targetPage: number): void {
    console.log(`Displaying Paged Content - Target: ${targetPage}`);
    // Let potential DOM updates from mode switch settle before measuring
    // setTimeout(() => { // Potential fix: Delay calculation slightly
    if (this.calculationNeeded) {
      this.recalculatePagedLayout(); // Perform calculation
    }

    if (this.totalPages === 0) { // Guard against calculation failure
      console.error("Cannot display paged content: totalPages is 0.");
      return;
    }

    const newPage = Math.max(1, Math.min(targetPage, this.totalPages));
    const startIndex = (newPage - 1) * this.linesPerPage;
    const endIndex = Math.min(startIndex + this.linesPerPage, this.lines.length);
    const pageLines = this.lines.slice(startIndex, endIndex);
    const newText = this.transformMarkdown(pageLines.join('\n'));

    console.log(`Target Page: ${targetPage}, New Page: ${newPage}, Current Page: ${this.currentPage}, New Text Empty: ${!newText}`);

    // Update text and current page *before* detectChanges
    this.currentPage = newPage;
    this.text = newText;

    // Scroll wrapper to top
    if (this.readerContentWrapperRef) {
      this.readerContentWrapperRef.nativeElement.scrollTop = 0;
    }

    // Explicitly trigger change detection *after* text update (Fix Bug 3)
    this.cdRef.detectChanges();
    // Sometimes an extra tick helps after major DOM change like mode switch
    // setTimeout(() => this.cdRef.detectChanges(), 0);


    // }, 0); // End of potential setTimeout wrapper
  }

  // Extracted calculation logic for clarity
  private recalculatePagedLayout(): void {
    console.log("Recalculating Lines Per Page for Paged Mode...");
    if (!this.readerContainerRef || !this.paginationControlsRef) {
      console.error("Cannot calculate layout - missing container or controls ref.");
      this.totalPages = 1; // Prevent errors, but layout is broken
      return;
    }
    const containerHeight = this.readerContainerRef.nativeElement.clientHeight;
    let controlsHeight = this.paginationControlsRef.nativeElement.offsetHeight;
    // Ensure controlsHeight is reasonable
    if (controlsHeight <= 0 || controlsHeight > containerHeight / 2) {
      console.warn(`Unusual controls height: ${controlsHeight}, estimating.`);
      // Estimate based on font size or use a fixed fallback
      controlsHeight = 40; // Adjust this fallback as needed
    }
    const availableHeight = Math.max(20, containerHeight - controlsHeight - 10);
    console.log(`Paged Calc - ContainerH: ${containerHeight}, ControlsH: ${controlsHeight}, AvailableH: ${availableHeight}`);

    if (availableHeight <= 20) {
      console.warn("Paged calculation skipped: Available height is too small.");
      this.linesPerPage = 20;
      this.totalPages = Math.max(1, Math.ceil(this.lines.length / this.linesPerPage));
    } else {
      this.linesPerPage = this.determineLinesPerPage(availableHeight);
      console.log(`Paged Calc - Lines Per Page: ${this.linesPerPage}`);
      this.pageHeightEstimate = availableHeight; // Update estimate based on paged calc
      this.totalPages = Math.max(1, Math.ceil(this.lines.length / (this.linesPerPage || 1))); // Avoid division by zero
    }
    this.calculationNeeded = false;
    console.log(`Paged Calculation complete: linesPerPage=${this.linesPerPage}, totalPages=${this.totalPages}, pageHeightEstimate: ${this.pageHeightEstimate}`);
  }


  // Binary search (remains the same)
  private determineLinesPerPage(availableHeight: number): number {
    const contentElement = this.readerContentRef.nativeElement;
    if (!this.lines.length || availableHeight <= 0) return 1;
    let low = 1, high = this.lines.length, bestFit = 1;
    contentElement.innerHTML = '';
    contentElement.offsetHeight; // Clear & reflow
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
    if (!this.scrollingMode || !this.readerContentWrapperRef || this.pageHeightEstimate <= 0) return;

    const wrapper = this.readerContentWrapperRef.nativeElement;
    const scrollTop = wrapper.scrollTop;
    const clientHeight = wrapper.clientHeight;
    // Use scrollHeight of the *content* for total size, not wrapper (unless they are same)
    // const scrollHeight = this.readerContentRef.nativeElement.scrollHeight;
    const scrollHeight = wrapper.scrollHeight; // Stick with wrapper scrollHeight for consistency with estimate
    console.log(`Scroll detected - ScrollTop: ${scrollTop}, ClientHeight: ${clientHeight}, ScrollHeight: ${scrollHeight}`);

    // Avoid calculation if scrollHeight is invalid
    if (scrollHeight <= clientHeight) {
      this.currentPage = 1; // Assume page 1 if content doesn't fill wrapper
      this.cdRef.detectChanges();
      return;
    }

    // Estimate page based on center of viewport
    let calculatedPage = Math.floor((scrollTop + clientHeight / 2) / this.pageHeightEstimate) + 1;
    calculatedPage = Math.max(1, Math.min(calculatedPage, this.totalPages)); // Clamp using paged totalPages

    if (calculatedPage !== this.currentPage) {
      console.log(`Scroll detected page change: ${this.currentPage} -> ${calculatedPage} (ScrollTop: ${scrollTop.toFixed(0)})`);
      this.isUpdatingSliderFromScroll = true; // Set flag
      this.currentPage = calculatedPage;
      this.cdRef.detectChanges(); // Update UI (slider + page number)
      // Reset flag slightly later so slider listener can ignore this update
      setTimeout(() => this.isUpdatingSliderFromScroll = false, 50); // Shorter timeout okay here
    }
  }

  private scrollToApproximatePage(pageNumber: number): void {
    if (!this.scrollingMode || !this.readerContentWrapperRef || this.pageHeightEstimate <= 0) return;
    console.log(`Scrolling to approximate page: ${pageNumber}`);
    // Ensure page number is valid
    const targetPage = Math.max(1, Math.min(pageNumber, this.totalPages));
    const targetScrollTop = (targetPage - 1) * this.pageHeightEstimate;
    const wrapper = this.readerContentWrapperRef.nativeElement;

    this.isUpdatingScrollFromPageChange = true;
    wrapper.scrollTo({top: targetScrollTop, behavior: 'smooth'});
    // Update currentPage immediately for visual feedback, scroll listener will refine if needed
    if (targetPage !== this.currentPage) {
      this.currentPage = targetPage;
      this.cdRef.detectChanges(); // Update slider/text immediately
    }
    setTimeout(() => this.isUpdatingScrollFromPageChange = false, 400); // Allow generous time for smooth scroll
  }

  // --- Navigation ---
  protected nextPage(): void {
    if (this.scrollingMode) {
      const nextPage = Math.min(this.totalPages, this.currentPage + 1);
      this.scrollToApproximatePage(nextPage);
    } else if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }

  protected prevPage(): void {
    if (this.scrollingMode) {
      const prevPage = Math.max(1, this.currentPage - 1);
      this.scrollToApproximatePage(prevPage);
    } else if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  // Paged mode navigation only
  protected goToPage(pageNumber: number): void {
    if (this.scrollingMode) {
      console.warn("goToPage called directly in scrolling mode - should use scrollToApproximatePage");
      this.scrollToApproximatePage(pageNumber); // Attempt to handle it
      return;
    }

    const targetPage = Math.max(1, Math.min(pageNumber, this.totalPages || 1));
    console.log(`goToPage (Paged): ${targetPage}`);
    this.updateDisplay(targetPage);
  }

  // --- Mode Toggle --- (Fix Bug 2 & 3)
  protected toggleScrollMode(): void {
    const pageBeforeToggle = this.currentPage; // Remember page before switching
    this.scrollingMode = !this.scrollingMode;
    console.log(`Toggled Scrolling Mode: ${this.scrollingMode}. Was on page ${pageBeforeToggle}`);
    this.calculationNeeded = !this.scrollingMode; // Need calculation if switching TO paged

    // Don't reset scroll explicitly here - let updateDisplay handle it
    // if (this.readerContentWrapperRef) { this.readerContentWrapperRef.nativeElement.scrollTop = 0; }

    // Update display, passing the page we want to be on *after* the switch
    this.updateDisplay(pageBeforeToggle);

    if (!this.scrollSubscription) {
      this.setupScrollListener();
    }
  }

  // --- Utilities ---
  private transformMarkdown(text: string): string { /* ... remains the same ... */
    return text.replace(/_(.*?)_/gs, '<em>$1</em>').replace(/\*(.*?)\*/gs, '<strong>$1</strong>').replace(/---/g, '<hr>').replace(/#{1,6}\s+(.*)/g, (match, p1) => {
      const level = match.indexOf(' ');
      return `<h${level}>${p1}</h${level}>`
    }).replace(/—/g, ' — ').replace(/[“”]/g, '"');
  }

  private arrayBufferToString(buffer: ArrayBuffer): string { /* ... remains the same ... */
    try {
      const decoder = new TextDecoder('utf-8', {fatal: true});
      return decoder.decode(buffer);
    } catch (e) {
      console.error("Failed UTF-8 decode", e);
      const decoder = new TextDecoder('windows-1252');
      return decoder.decode(buffer);
    }
  }
}
