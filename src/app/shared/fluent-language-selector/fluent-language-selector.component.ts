import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {Observable, of, Subject} from 'rxjs';
import {debounceTime, distinctUntilChanged, startWith, switchMap} from 'rxjs/operators';
import {CommonModule} from '@angular/common';
import {TuiMultiSelectModule, TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {TUI_VALIDATION_ERRORS, TuiFieldErrorPipe} from "@taiga-ui/kit";
import {Language} from "../../models/language.model";
import {TuiError} from "@taiga-ui/core";

const MAX_LANGUAGES = 3;

@Component({
    selector: 'app-fluent-language-selector',
    templateUrl: './fluent-language-selector.component.html',
    styleUrls: ['./fluent-language-selector.component.less'],
    imports: [
        ReactiveFormsModule,
        CommonModule,
        TuiMultiSelectModule,
        TuiTextfieldControllerModule,
        TuiError,
        TuiFieldErrorPipe,
    ],
    providers: [
        {
            provide: TUI_VALIDATION_ERRORS,
            useValue: {
                required: 'At least one language is required',
                maxLanguages: () => {
                    return `You can select up to ${MAX_LANGUAGES} languages`;
                },
            },
        },
    ]
})
export class FluentLanguageSelectorComponent implements OnInit {
  @Input() languages: Language[] = []; // **Input from parent**
  @Input() size: 's' | 'm' | 'l' = 'l';
  @Input() selectedLanguages?: string[] = []; // **Input from parent**
  @Output() selectedFluentLanguages = new EventEmitter<string[]>(); // **Emit selected languages to parent**

  maxLanguages = MAX_LANGUAGES;

  // **Form control with validators**
  fluentLanguageControl = new FormControl<string[]>([], [
    Validators.required,
    this.maxLanguagesValidator(this.maxLanguages),
  ]);

  // **Search subject**
  fluentSearch$ = new Subject<string>();

  // **Filtered items observable**
  filteredFluentLanguages$: Observable<string[]>;

  constructor() {
    // **Initialize filtered languages observable**
    this.filteredFluentLanguages$ = this.fluentSearch$.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((search) => this.filterFluentLanguages(search))
    );
  }

  ngOnInit(): void {
    // **Emit selected languages whenever the form control value changes**
    this.fluentLanguageControl.valueChanges.subscribe((value) => {
      this.selectedFluentLanguages.emit(value || []);
    });

    if (this.selectedLanguages) {
      this.fluentLanguageControl.setValue(this.selectedLanguages);
    }
  }

  // **Validator to enforce maximum number of languages**
  maxLanguagesValidator(max: number) {
    return (control: FormControl): { [key: string]: any } | null => {
      const value = control.value as string[] | null;
      if (value && value.length > max) {
        return {maxLanguages: true}; // Return a simple error flag
      }
      return null;
    };
  }

  // **Filter languages based on search query**
  private filterFluentLanguages(search: string): Observable<string[]> {
    const filtered = this.languages
      .map((lang) => lang.name)
      .filter((name) => name.toLowerCase().includes(search.toLowerCase()));
    return of(filtered); // Return the filtered list
  }
}
