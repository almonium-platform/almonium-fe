import {Component, Input, OnDestroy, OnInit, Renderer2} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {NgClass, NgForOf, NgIf, NgOptimizedImage} from '@angular/common';
import {catchError, map} from 'rxjs/operators';
import {of} from 'rxjs';
import {FormsModule} from "@angular/forms";
import {ContenteditableValueAccessorModule} from '@tinkoff/angular-contenteditable-accessor';
import {TuiBadgeModule} from "@taiga-ui/kit";
import {ActivatedRoute} from "@angular/router";
import {FrequencyService} from "../../services/frequency.service";
import {NavbarComponent} from "../../shared/navbars/navbar/navbar.component";
import {Language} from "../../models/language.enum";
import {LanguageService} from "../../services/language.service";
import {NavbarWrapperComponent} from "../../shared/navbars/navbar-wrapper/navbar-wrapper.component";

@Component({
  selector: 'app-discover',
  templateUrl: './discover.component.html',
  styleUrls: ['./discover.component.less'],
  imports: [
    NgForOf,
    NgIf,
    FormsModule,
    NgOptimizedImage,
    ContenteditableValueAccessorModule,
    TuiBadgeModule,
    NgClass,
    NavbarComponent,
    NavbarWrapperComponent
  ],
  standalone: true,
})
export class DiscoverComponent implements OnInit, OnDestroy {
  @Input() searchText: string = '';
  filteredOptions: string[] = [];
  currentFocus: number = -1;
  frequency: number = 0;
  submitted: boolean = false;
  currentLanguage: Language = Language.EN;

  private globalKeydownListener!: () => void;

  constructor(
    private http: HttpClient,
    private renderer: Renderer2,
    private route: ActivatedRoute,
    private frequencyService: FrequencyService,
    private languageService: LanguageService
  ) {
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.searchText = params['text'] || '';
      if (this.searchText) {
        this.onSearchChange(this.searchText);
      }
    });

    this.globalKeydownListener = this.renderer.listen('document', 'keydown', (event: KeyboardEvent) => {
      if (event.key === '/') {
        this.focusSearchInput();
        event.preventDefault();
      }
    });
    this.languageService.currentLanguage$.subscribe((currentLanguage) => {
      if (currentLanguage) {
        this.currentLanguage = currentLanguage;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.globalKeydownListener) {
      this.globalKeydownListener();
    }
  }

  private focusSearchInput(): void {
    const element = this.renderer.selectRootElement('.search-input', true);
    if (element) {
      element.focus();

      // Move cursor to the end after focusing
      const range = document.createRange();
      const selection = window.getSelection();

      if (selection) {
        range.selectNodeContents(element);
        range.collapse(false); // Move cursor to the end
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }

  private onSubmit(): void {
    this.submitted = true;
    this.filteredOptions = [];
    if (this.searchText) {
      this.frequencyService.getFrequency(this.searchText, this.currentLanguage).subscribe((freq) => {
        this.frequency = freq;
      });
    }
  }

  onSearchChange(searchText: string): void {
    this.searchText = this.sanitizeInput(searchText);
    this.submitted = false;
    this.currentFocus = -1;

    if (searchText && searchText.length >= 3 && this.currentLanguage === Language.EN) {
      const apiUrl = `https://api.datamuse.com/sug?k=demo&s=${searchText}&max=5`;
      this.http.get<{ word: string }[]>(apiUrl).pipe(
        map((data: { word: string }[]) => data.map(item => item.word).slice(0, 5)), // Slice to ensure only 5 suggestions
        catchError(() => of([]))
      ).subscribe(options => {
        if (!this.submitted) {
          this.filteredOptions = options;
        }
      });
    } else {
      this.filteredOptions = [];
    }

    // Preserve cursor position logic
    const element = this.renderer.selectRootElement('.search-input', true);
    const selection = window.getSelection();

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const cursorPosition = range.startOffset;

      // Refocus the input and preserve cursor position
      element.focus();

      // Use a setTimeout to ensure cursor position logic executes after rendering
      setTimeout(() => {
        const newRange = document.createRange();
        const newSelection = window.getSelection();

        // Set the range at the preserved cursor position
        newRange.setStart(element.childNodes[0], cursorPosition);
        newRange.collapse(true);

        // Apply the new range as the current selection
        newSelection?.removeAllRanges();
        newSelection?.addRange(newRange);
      }, 0); // Timeout of 0 ensures the next task in the event loop
    } else {
      element.focus();
    }
  }

  private sanitizeInput(input: string): string {
    const div = document.createElement('div');
    div.innerHTML = input;
    return div.textContent || div.innerText || '';
  }

  protected onOptionSelected(option: string): void {
    this.searchText = option;
    this.onSubmit();

    // Use setTimeout to ensure DOM updates before focusing
    setTimeout(() => {
      this.focusSearchInput();
    }, 0);
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      this.currentFocus++;
      if (this.currentFocus >= this.filteredOptions.length) {
        this.currentFocus = 0;
      }
    } else if (event.key === 'ArrowUp') {
      this.currentFocus--;
      if (this.currentFocus < 0) {
        this.currentFocus = this.filteredOptions.length - 1;
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.currentFocus > -1 && this.currentFocus < this.filteredOptions.length) {
        this.onOptionSelected(this.filteredOptions[this.currentFocus]);
      }
      this.onSubmit();
    } else if (event.key === 'Escape') {
      this.filteredOptions = [];
      this.currentFocus = -1;
      const element = this.renderer.selectRootElement('.search-input', true);
      if (element) {
        element.blur();
      }
    }
  }

  protected isOptionFocused(index: number): boolean {
    return this.currentFocus === index;
  }

  protected getGaussianGradient(frequency: number): string {
    // Map frequency (1-100) to hue values in a broader range (250-340 for purple-pink-blue)
    const startHue = 160;
    const endHue = 280;
    const hue = startHue + (endHue - startHue) * (frequency / 100);

    const startColor = `hsl(${hue}, 80%, 60%)`;
    const endColor = `hsl(${hue + 60}, 90%, 40%)`;

    return `linear-gradient(45deg, ${startColor} 0%, ${endColor} 100%)`;
  }

  protected getFrequencyLabel(frequency: number): string {
    if (frequency <= 20) return "Extremely Rare";
    if (frequency <= 30) return "Pretty Rare";
    if (frequency <= 40) return "Challenging";
    if (frequency <= 75) return "Comfort Zone";
    return "Essential";
  }

  protected getFrequencyDescription(frequency: number): string {
    if (frequency <= 20) return "Too rare to be useful";
    if (frequency <= 30) return "Learn if need to";
    if (frequency <= 40) return "Ideal candidate";
    if (frequency <= 75) return "You probably know it";
    return "Top 50 words";
  }
}
