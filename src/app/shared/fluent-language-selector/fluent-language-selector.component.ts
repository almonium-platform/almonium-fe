import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {Observable, of, Subject} from 'rxjs';
import {debounceTime, distinctUntilChanged, map, startWith, switchMap} from 'rxjs/operators';
import {CommonModule} from '@angular/common';
import {Language} from '../../models/language.model';

import {
  TUI_VALIDATION_ERRORS,
  TuiChevron,
  TuiDataListWrapperComponent,
  TuiFieldErrorPipe,
  TuiInputChipComponent,
  TuiInputChipDirective,
  TuiMultiSelectGroupDirective
} from '@taiga-ui/kit';
import {TuiError, TuiTextfieldDropdownDirective, TuiTextfieldMultiComponent} from '@taiga-ui/core';
import {TuiItem} from '@taiga-ui/cdk';

const MAX_LANGUAGES = 3;

@Component({
  selector: 'app-fluent-language-selector',
  templateUrl: './fluent-language-selector.component.html',
  styleUrls: ['./fluent-language-selector.component.less'],
  imports: [
    ReactiveFormsModule,
    CommonModule,
    TuiError,
    TuiFieldErrorPipe,
    TuiTextfieldMultiComponent,
    TuiChevron,
    TuiInputChipDirective,
    TuiDataListWrapperComponent,
    TuiTextfieldDropdownDirective,
    TuiMultiSelectGroupDirective,
    TuiItem,
    TuiInputChipComponent,
  ],
  providers: [
    {
      provide: TUI_VALIDATION_ERRORS,
      useValue: {
        required: 'At least one language is required',
        maxLanguages: () => `You can select up to ${MAX_LANGUAGES} languages`,
      },
    },
  ],
  standalone: true,
})
export class FluentLanguageSelectorComponent implements OnInit, OnChanges {
  @Input() languages: Language[] = [];
  @Input() size: 's' | 'm' | 'l' = 'l';
  @Input() selectedLanguages?: string[] = [];
  @Output() selectedFluentLanguages = new EventEmitter<{ languages: string[]; valid: boolean }>();
  @ViewChild('chipInput', {static: true}) chipInput!: ElementRef<HTMLInputElement>;
  private allowed = new Set<string>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['languages']) {
      this.allowed = new Set(this.languages.map(l => l.name));
      // re-sanitize if languages list changed
      this.sanitizeControl();
    }
  }

  private sanitizeControl(): void {
    const raw = this.fluentLanguageControl.value ?? [];
    const cleaned: string[] = [];
    for (const v of raw) {
      if (this.allowed.has(v) && !cleaned.includes(v) && cleaned.length < this.maxLanguages) {
        cleaned.push(v);
      }
    }
    // only write back if changed to avoid loops
    if (raw.length !== cleaned.length || raw.some((v, i) => v !== cleaned[i])) {
      this.fluentLanguageControl.setValue(cleaned, {emitEvent: false});
    }
  }

  maxLanguages = MAX_LANGUAGES;

  fluentLanguageControl = new FormControl<string[]>([], [
    Validators.required,
    this.maxLanguagesValidator(this.maxLanguages),
  ]);

  // text typed into the input
  private fluentSearch$ = new Subject<string>();

  filteredFluentLanguages$: Observable<string[]> = this.fluentSearch$.pipe(
    startWith(''),
    debounceTime(200),
    distinctUntilChanged(),
    switchMap(search => this.filterFluentLanguages(search)),
  );

  // keep last filtered list for Enter handling
  private lastFiltered: string[] = [];

  ngOnInit(): void {
    this.filteredFluentLanguages$.subscribe(list => (this.lastFiltered = list));

    this.fluentLanguageControl.valueChanges.subscribe(() => {
      this.sanitizeControl(); // strip “fre” etc.
      const value = this.fluentLanguageControl.value ?? [];
      this.selectedFluentLanguages.emit({
        languages: value,
        valid: this.fluentLanguageControl.valid,
      });
    });

    if (this.selectedLanguages?.length) {
      this.fluentLanguageControl.setValue(this.selectedLanguages);
    }
  }

  // capture typing from the native input
  onType(event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.fluentSearch$.next(value);
  }

  // clicking an option -> add it to chips
  onPick(item?: string): void {
    if (!item) return;

    const current = this.fluentLanguageControl.value ?? [];
    if (!current.includes(item) && current.length < this.maxLanguages) {
      this.fluentLanguageControl.setValue([...current, item]);
    }

    // clear the text in the input and reset filtering
    if (this.chipInput?.nativeElement) {
      this.chipInput.nativeElement.value = '';
    }
    this.fluentSearch$.next('');
  }

  // block Enter/Comma/Space from creating free chips
  trapSeparators(event: KeyboardEvent): void {
    const key = event.key;
    if (key === 'Enter' || key === ',' || key === ' ') {
      // if a dropdown item is focused, Taiga will handle Enter via itemClick;
      // we still prevent the input from turning current text into a chip
      event.preventDefault();
      event.stopPropagation();
    }
  }

// "type + Enter" — accept the first suggestion only (if any)
  onEnter(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.lastFiltered?.length) {
      this.onPick(this.lastFiltered[0]);
    }
  }

  private maxLanguagesValidator(max: number) {
    return (control: FormControl): { [key: string]: any } | null => {
      const value = control.value as string[] | null;
      return value && value.length > max ? {maxLanguages: true} : null;
    };
  }

  private filterFluentLanguages(search: string): Observable<string[]> {
    const q = search.toLowerCase().trim();
    const selected = new Set(this.fluentLanguageControl.value ?? []);
    const filtered = this.languages
      .map(l => l.name)
      .filter(name => !selected.has(name))
      .filter(name => (q ? name.toLowerCase().includes(q) : true));
    return of(filtered);
  }
}
