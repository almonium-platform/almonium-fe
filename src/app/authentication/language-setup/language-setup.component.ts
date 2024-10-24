import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {Router} from '@angular/router';
import {CommonModule} from '@angular/common';
import {
  TUI_VALIDATION_ERRORS,
  TuiDataListWrapperModule,
  TuiFieldErrorPipeModule,
  TuiMultiSelectModule,
  TuiSelectModule,
} from '@taiga-ui/kit';
import {TuiErrorModule, TuiTextfieldControllerModule,} from '@taiga-ui/core';
import {delay, Observable, of, Subject} from 'rxjs';
import {debounceTime, distinctUntilChanged, startWith, switchMap} from 'rxjs/operators';
import {Language} from '../../models/language.model';
import {LanguageSetupService} from './language-setup.service';
import {ParticlesService} from "../../services/particles.service";
import {NgxParticlesModule} from "@tsparticles/angular";
import {UserInfoService} from "../../services/user-info.service";

const MAX_LANGUAGES = 3;

@Component({
  selector: 'app-language-setup',
  templateUrl: './language-setup.component.html',
  styleUrls: ['./language-setup.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
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
  ],
  imports: [
    ReactiveFormsModule,
    CommonModule,
    TuiMultiSelectModule,
    TuiSelectModule,
    TuiTextfieldControllerModule,
    TuiErrorModule,
    TuiFieldErrorPipeModule,
    TuiDataListWrapperModule,
    NgxParticlesModule,
  ],
})
export class LanguageSetupComponent implements OnInit {
  languageForm: FormGroup;
  languages: Language[] = [];
  supportedLanguages: Language[] = [];
  otherLanguages: Language[] = [];

  maxLanguages = 3;

  // Form controls with validators
  fluentLanguageControl = new FormControl<string[]>([], [
    Validators.required,
    this.maxLanguagesValidator(this.maxLanguages),
  ]);
  targetLanguageControl = new FormControl<string[]>([], [
    Validators.required,
    this.maxLanguagesValidator(this.maxLanguages),
  ]);

  // Search subjects
  fluentSearch$ = new Subject<string>();
  targetSearch$ = new Subject<string>();

  // Filtered items observables
  filteredFluentLanguages$: Observable<string[]>;
  filteredTargetLanguages$: Observable<string[][]>;

  id = 'tsparticles';
  particlesOptions$ = this.particlesService.particlesOptions$;

  // Grouped items for multi-select
  labels: string[] = ['Languages with Extra Features', 'Other Languages'];

  // Features for selected target languages
  selectedTargetLanguageFeatures: {
    special: { feature: string; languages: string[] }[];
    basic: { feature: string; languages: string[] }[]
  } = {special: [], basic: []};

  // Define basic features applicable to all languages
  basicFeatures: string[] = ['Translation', 'Flashcards', 'Training Statistics', 'Standard Games',];

  // Additional features for specific languages
  languageFeatures: { [code: string]: string[] } = {
    en: ['Lexemes', 'Frequency', 'Prepared Decks', 'Parts of Speech'],
    de: ['Lexemes', 'Frequency', 'Prepared Decks'],
    // Add more if needed
  };

  constructor(
    private fb: FormBuilder,
    private languageService: LanguageSetupService,
    private router: Router,
    protected particlesService: ParticlesService,
    private userInfoService: UserInfoService,
  ) {
    this.languageForm = this.fb.group({
      fluentLanguages: this.fluentLanguageControl,
      targetLanguages: this.targetLanguageControl,
    });

    this.filteredFluentLanguages$ = this.fluentSearch$.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((search) => this.filterFluentLanguages(search))
    );

    this.filteredTargetLanguages$ = this.targetSearch$.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((search) => this.filterTargetLanguages(search))
    );
  }

  ngOnInit(): void {
    this.particlesService.initializeParticles();
    this.languageService.getLanguages().subscribe((languages) => {
      this.languages = languages;

      // Separate languages with extra features and other languages
      this.supportedLanguages = this.languages
        .filter((lang) => Object.keys(this.languageFeatures).includes(lang.code))
        .sort((a, b) => a.name.localeCompare(b.name));

      this.otherLanguages = this.languages
        .filter((lang) => !Object.keys(this.languageFeatures).includes(lang.code))
        .sort((a, b) => a.name.localeCompare(b.name));
    });

    // Update features when target languages change
    this.targetLanguageControl.valueChanges.subscribe(() => {
      this.updateSelectedFeatures();
    });
  }

  maxLanguagesValidator(max: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as string[] | null;
      if (value && value.length > max) {
        return {maxLanguages: true}; // Return a simple error flag
      }
      return null;
    };
  }

  /**
   * Filter languages based on search query and type (fluent or target)
   */
  private filterFluentLanguages(search: string): Observable<string[]> {
    const filtered = this.languages
      .map(lang => lang.name)
      .filter(name => name.toLowerCase().includes(search.toLowerCase()));
    return of(filtered).pipe(delay(300)); // Simulate server delay if needed
  }

  private filterTargetLanguages(search: string): Observable<string[][]> {
    const supportedLangNames = this.supportedLanguages
      .map(lang => lang.name)
      .filter(name => name.toLowerCase().includes(search.toLowerCase()));
    const otherLangNames = this.otherLanguages
      .map(lang => lang.name)
      .filter(name => name.toLowerCase().includes(search.toLowerCase()));
    return of([supportedLangNames, otherLangNames]).pipe(delay(300)); // Simulate server delay if needed
  }


  updateSelectedFeatures(): void {
    const selectedLangNames = this.targetLanguageControl.value || [];
    const specialFeaturesMap: { [feature: string]: Set<string> } = {};
    const basicFeaturesMap: { [feature: string]: Set<string> } = {};

    selectedLangNames.forEach((langName) => {
      const lang = this.languages.find((l) => l.name === langName);
      if (lang) {
        const langCode = lang.code;

        // Special features for specific languages
        if (this.languageFeatures[langCode]) {
          this.languageFeatures[langCode].forEach((feature) => {
            if (!specialFeaturesMap[feature]) {
              specialFeaturesMap[feature] = new Set();
            }
            specialFeaturesMap[feature].add(lang.name);
          });
        }

        // Basic features for all languages
        this.basicFeatures.forEach((feature) => {
          if (!basicFeaturesMap[feature]) {
            basicFeaturesMap[feature] = new Set();
          }
          basicFeaturesMap[feature].add(lang.name);
        });
      }
    });

    // Convert maps to arrays for display
    this.selectedTargetLanguageFeatures.special = Object.keys(specialFeaturesMap).map((feature) => ({
      feature,
      languages: Array.from(specialFeaturesMap[feature]),
    }));

    this.selectedTargetLanguageFeatures.basic = Object.keys(basicFeaturesMap).map((feature) => ({
      feature,
      languages: Array.from(basicFeaturesMap[feature]),
    }));
  }

  onSubmit(): void {
    if (this.languageForm.invalid) {
      // Show error message
      return;
    }

    const fluentLanguageNames = this.fluentLanguageControl.value || [];
    const targetLanguageNames = this.targetLanguageControl.value || [];

    // Map language names back to codes
    const fluentLanguageCodes = fluentLanguageNames
      .map((name) => {
        const lang = this.languages.find((l) => l.name === name);
        return lang ? lang.code.toUpperCase() : null;
      })
      .filter((code): code is string => code !== null);

    const targetLanguageCodes = targetLanguageNames
      .map((name) => {
        const lang = this.languages.find((l) => l.name === name);
        return lang ? lang.code.toUpperCase() : null;
      })
      .filter((code): code is string => code !== null);

    const payload = {
      fluentLangs: fluentLanguageCodes,
      targetLangs: targetLanguageCodes,
    };

    this.languageService.saveUserLanguages(payload).subscribe({
      next: () => {
        // Redirect to /home
        this.router.navigate(['/home']).then(() => console.log('Navigated to /home'));
        this.userInfoService.clearUserInfo();
      },
      error: (error) => {
        // Handle error (show message to user)
        console.error('Error saving languages:', error);
      },
    });
  }
}
