import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {Observable, of, Subject} from 'rxjs';
import {debounceTime, distinctUntilChanged, map, startWith, switchMap} from 'rxjs/operators';
import {CommonModule} from '@angular/common';
import {Language} from "../../models/language.model";

import {
  TUI_VALIDATION_ERRORS,
  TuiChevron,
  TuiDataListWrapperComponent,
  TuiFieldErrorPipe,
  TuiInputChipComponent,
  TuiInputChipDirective,
  TuiMultiSelectGroupDirective
} from "@taiga-ui/kit";
import {
  TuiError,
  TuiTextfieldDropdownDirective,
  TuiTextfieldMultiComponent,
  TuiTextfieldOptionsDirective
} from "@taiga-ui/core";
import {TuiItem} from "@taiga-ui/cdk";

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
    TuiTextfieldOptionsDirective,
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
        maxLanguages: () => {
          return `You can select up to ${MAX_LANGUAGES} languages`;
        },
      },
    },
  ]
})
export class FluentLanguageSelectorComponent implements OnInit {
  @Input() languages: Language[] = [];
  @Input() size: 's' | 'm' | 'l' = 'l';
  // todo rename disambiguate
  @Input() selectedLanguages?: string[] = [];
  @Output() selectedFluentLanguages = new EventEmitter<{ languages: string[]; valid: boolean }>();

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
    this.fluentLanguageControl.valueChanges.pipe(
      map((value) => ({
        languages: value || [],
        valid: this.fluentLanguageControl.valid,
      }))
    ).subscribe((state) => {
      this.selectedFluentLanguages.emit(state);
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
