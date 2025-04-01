import {
  Component,
  OnInit,
  ElementRef,
  ViewChild,
  HostListener,
  AfterViewInit,
  ChangeDetectorRef,
  OnDestroy
} from '@angular/core';
import { ReadService } from '../read.service';
import { CommonModule } from '@angular/common';
import { TuiAlertService } from '@taiga-ui/core';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-reader',
  standalone: true, // Assuming Standalone Component based on imports block
  imports: [CommonModule],
  templateUrl: './reader.component.html',
  styleUrls: ['./reader.component.less'],
})
export class ReaderComponent implements OnInit, AfterViewInit, OnDestroy {
  // --- Properties ---
  protected text: string = ''; // HTML content for the current page
  private fullText: string = ''; // Raw full text from service
  protected lines: string[] = []; // Full text split into lines
  protected isLoading: boolean = true;
  protected errorMessage: string | null = null;

  protected currentPage: number = 1;
  protected totalPages: number = 1;
  private linesPerPage: number = 10; // Initial guess, will be calculated
  private calculationNeeded: boolean = true; // Flag to trigger calculation

  // Element References for measurement
  @ViewChild('readerContent') readerContentRef!: ElementRef<HTMLDivElement>;
  private containerElement!: HTMLElement; // The element whose height defines the view page

  // Resize handling
  private resizeSubject = new Subject<void>();
  private destroy$ = new Subject<void>(); // For unsubscribing

  // Debounce timer for resize
  private readonly RESIZE_DEBOUNCE_TIME = 250; // ms


  constructor(
    private readService: ReadService,
    private alertService: TuiAlertService,
    private elementRef: ElementRef, // Reference to the component's host element
    private cdRef: ChangeDetectorRef // To manually trigger change detection
  ) {}

  // --- Lifecycle Hooks ---

  ngOnInit(): void {
    this.containerElement = this.elementRef.nativeElement; // Use component host as container
    this.loadBook();
    this.setupResizeListener();
  }

  ngAfterViewInit(): void {
    // We need the view to be initialized to measure elements
    // If text is already loaded, calculate now. Otherwise, it will be done in loadBook's success.
    if (!this.isLoading && this.lines.length > 0) {
      this.calculateAndDisplayPage();
    }
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

  // --- Core Logic ---

  private setupResizeListener(): void {
    this.resizeSubject
      .pipe(
        debounceTime(this.RESIZE_DEBOUNCE_TIME),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        console.log('Window resized, recalculating layout...');
        this.calculationNeeded = true;
        this.calculateAndDisplayPage();
        this.cdRef.detectChanges(); // Trigger change detection after async operation
      });
  }

  private loadBook(): void {
    const bookId = 1; // Replace with the actual book ID
    this.isLoading = true;
    this.errorMessage = null;
    this.text = ''; // Clear previous text

    this.readService.loadBook(bookId).subscribe({
      next: (response) => {
        if (response.status === 200 && response.body) {
          this.fullText = this.arrayBufferToString(response.body);
          this.lines = this.fullText.split('\n');
          this.isLoading = false;
          this.calculationNeeded = true; // Mark for calculation

          // If view is ready, calculate now. Otherwise, ngAfterViewInit will handle it.
          if (this.readerContentRef) {
            this.calculateAndDisplayPage();
          }
          // No need for explicit cdRef here, Angular handles changes from Observable sub

        } else {
          this.handleError(`Failed to load book. Status: ${response.status}`);
        }
      },
      error: (error) => {
        const message = error?.error?.message || 'An unknown error occurred while loading the book.';
        this.handleError(message);
        this.alertService.open(message, { appearance: 'error' }).subscribe();
      },
    });
  }

  private handleError(message: string): void {
    console.error(message);
    this.errorMessage = message;
    this.isLoading = false;
    this.text = '';
    this.lines = [];
    this.currentPage = 1;
    this.totalPages = 1;
    // Consider showing the error message in the template
    this.cdRef.detectChanges(); // Update view with error state
  }

  // The core calculation method
  private calculateAndDisplayPage(targetPage: number = 1): void {
    if (this.isLoading || !this.lines.length || !this.containerElement || !this.readerContentRef) {
      console.warn("Calculation skipped: component not ready or no content.");
      return; // Not ready yet
    }

    // Only recalculate linesPerPage if needed (initial load or resize)
    if (this.calculationNeeded) {
      console.log("Calculating lines per page...");
      const availableHeight = this.containerElement.clientHeight;
      if (availableHeight <= 0) {
        console.warn("Calculation skipped: container has zero height.");
        // Maybe schedule a retry?
        // setTimeout(() => this.calculateAndDisplayPage(targetPage), 100);
        return;
      }

      this.linesPerPage = this.determineLinesPerPage(availableHeight);
      this.totalPages = Math.max(1, Math.ceil(this.lines.length / this.linesPerPage));
      this.calculationNeeded = false; // Calculation done
      console.log(`Calculation complete: linesPerPage=${this.linesPerPage}, totalPages=${this.totalPages}`);
    }

    // Ensure target page is within bounds
    this.currentPage = Math.max(1, Math.min(targetPage, this.totalPages));

    // Get the lines for the current page
    const startIndex = (this.currentPage - 1) * this.linesPerPage;
    const endIndex = Math.min(startIndex + this.linesPerPage, this.lines.length);
    const pageLines = this.lines.slice(startIndex, endIndex);

    // Update the displayed text
    this.text = this.transformMarkdown(pageLines.join('\n'));

    // Important: Let Angular update the DOM
    this.cdRef.detectChanges();

    // Optional: Scroll to top after page change
    // this.readerContentRef.nativeElement.scrollTop = 0;
    // Or maybe the container element?
    // this.containerElement.scrollTop = 0;
  }

  private determineLinesPerPage(containerHeight: number): number {
    const contentElement = this.readerContentRef.nativeElement;
    let currentLines = 1;
    let measuredHeight = 0;

    // Reset content for measurement
    contentElement.innerHTML = '';

    // Edge case: Container too small for even one line (or zero height initially)
    // Render one line to get *some* measurement
    if (this.lines.length > 0) {
      contentElement.innerHTML = this.transformMarkdown(this.lines[0]);
      // Force reflow/repaint for accurate measurement
      contentElement.offsetHeight; // Reading offsetHeight forces reflow
      measuredHeight = contentElement.scrollHeight;
      if (measuredHeight > containerHeight && measuredHeight > 0) return 1; // Fits only 1 line partially
    } else {
      return 1; // No lines, default to 1 page capacity conceptually
    }


    while (currentLines <= this.lines.length) {
      const testLines = this.lines.slice(0, currentLines);
      contentElement.innerHTML = this.transformMarkdown(testLines.join('\n'));

      // Force reflow before measuring scrollHeight
      contentElement.offsetHeight;
      measuredHeight = contentElement.scrollHeight;
      // console.log(`Testing ${currentLines} lines, height: ${measuredHeight} vs container: ${containerHeight}`);


      if (measuredHeight > containerHeight) {
        // The previous number of lines was the maximum that fit
        return Math.max(1, currentLines - 1); // Ensure at least 1 line fits
      }

      if (currentLines === this.lines.length) {
        // All lines fit
        return this.lines.length;
      }

      currentLines++;

      // Safety break for very large containers / potential infinite loops
      if (currentLines > this.lines.length + 5) { // Arbitrary limit
        console.warn("Breaking calculation loop, potential issue.");
        return Math.max(1, currentLines -1);
      }
    }

    return Math.max(1, this.lines.length); // Should technically be caught by loop end condition
  }

  // --- Navigation ---

  protected nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.calculateAndDisplayPage(this.currentPage + 1);
    }
  }

  protected prevPage(): void {
    if (this.currentPage > 1) {
      this.calculateAndDisplayPage(this.currentPage - 1);
    }
  }

  // --- Utility ---

  private transformMarkdown(text: string): string {
    // The 's' flag makes . match newlines
    return text
      .replace(/_(.*?)_/gs, '<em>$1</em>') // Italics
      .replace(/\*(.*?)\*/gs, '<strong>$1</strong>') // Bold (Added example)
      .replace(/—/g, ' — ') // Em dash spacing
      .replace(/”/g, '"') // Closing quote
      .replace(/“/g, '"'); // Opening quote
  }

  private arrayBufferToString(buffer: ArrayBuffer): string {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
  }
}
