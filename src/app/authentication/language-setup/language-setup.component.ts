import {TuiMultiSelectModule, TuiSelectModule, TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
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
import {ActivatedRoute, Router} from '@angular/router';
import {CommonModule} from '@angular/common';
import {TUI_VALIDATION_ERRORS, TuiDataListWrapper, TuiFieldErrorPipe} from '@taiga-ui/kit';
import {TuiAlertService, TuiError} from '@taiga-ui/core';
import {delay, Observable, of, Subject, takeUntil} from 'rxjs';
import {debounceTime, distinctUntilChanged, startWith, switchMap} from 'rxjs/operators';
import {Language} from '../../models/language.model';
import {LanguageApiService} from '../../services/language-api.service';
import {NgxParticlesModule} from "@tsparticles/angular";
import {UserInfoService} from "../../services/user-info.service";
import {
  FluentLanguageSelectorComponent
} from "../../shared/fluent-language-selector/fluent-language-selector.component";
import {LanguageNameService} from "../../services/language-name.service";
import {ValidationMessagesService} from "./validation-messages-service";
import {SupportedLanguagesService} from "../../services/supported-langs.service";
import {UserInfo} from "../../models/userinfo.model";
import {ParticlesComponent} from "../../shared/particles/particles.component";


@Component({
  selector: 'app-language-setup',
  templateUrl: './language-setup.component.html',
  styleUrls: ['./language-setup.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: TUI_VALIDATION_ERRORS,
      useFactory: (validationMessagesService: ValidationMessagesService) => {
        return validationMessagesService.getValidationMessages();
      },
      deps: [ValidationMessagesService],
    },
  ],
  imports: [
    ReactiveFormsModule,
    CommonModule,
    TuiMultiSelectModule,
    TuiSelectModule,
    TuiTextfieldControllerModule,
    TuiError,
    TuiFieldErrorPipe,
    TuiDataListWrapper,
    NgxParticlesModule,
    FluentLanguageSelectorComponent,
    ParticlesComponent,
  ]
})
export class LanguageSetupComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private static readonly MAX_LANGUAGES = 3;

  userInfo: UserInfo | null = null;
  languageForm: FormGroup;
  supportedLanguages: Language[] = [];
  availableTargetLanguages: Language[] = [];
  specialTargetLanguages: Language[] = [];
  otherTargetLanguages: Language[] = [];
  selectedFluentLanguages: string[] = [];

  targetLanguageControl = new FormControl<string[]>([], [
    Validators.required,
    this.maxLanguagesValidator(LanguageSetupComponent.MAX_LANGUAGES),
  ]);

  // Search subjects
  targetSearch$ = new Subject<string>();

  // Filtered items observables
  filteredTargetLanguages$: Observable<string[][]>;

  // Grouped items for multi-select
  labels: string[] = ['Languages with Extra Features', 'Other Languages'];

  // Features for selected target languages
  selectedTargetLanguageFeatures: {
    special: { feature: string; languages: string[] }[];
    basic: { feature: string; languages: string[] }[]
  } = {special: [], basic: []};

  // Define basic features applicable to all languages
  basicFeatures: string[] = ['Translation', 'Flashcards', 'Statistics', 'Standard Games',];

  // Additional features for specific languages
  languageFeatures: { [code: string]: string[] } = {
    en: ['Lexemes', 'Frequency', 'Prepared Decks', 'Parts of Speech'],
    de: ['Lexemes', 'Frequency', 'Prepared Decks'],
    // Add more if needed
  };

  protected mode: 'add-target' | 'default' = 'default';

  constructor(
    private fb: FormBuilder,
    private languageApiService: LanguageApiService,
    private languageNameService: LanguageNameService,
    private router: Router,
    private userInfoService: UserInfoService,
    private route: ActivatedRoute,
    private alertService: TuiAlertService,
    private validationMessagesService: ValidationMessagesService,
    private supportedLanguagesService: SupportedLanguagesService,
  ) {
    this.languageForm = this.fb.group({
      targetLanguages: this.targetLanguageControl,
    });

    this.filteredTargetLanguages$ = this.targetSearch$.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((search) => this.filterTargetLanguages(search))
    );
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['mode'] === 'add-target') {
        this.mode = 'add-target';
        const maxLanguages = 1;
        this.validationMessagesService.setMaxLanguages(maxLanguages);

        // Update validators dynamically
        this.targetLanguageControl.setValidators([
          Validators.required,
          this.maxLanguagesValidator(maxLanguages),
        ]);
        this.targetLanguageControl.updateValueAndValidity();
      }
    });

    this.supportedLanguagesService.supportedLanguages$.subscribe((languages) => {
      if (!languages) {
        return;
      }

      this.userInfoService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe((info) => {
        if (!info) {
          return;
        }
        this.userInfo = info;

        this.supportedLanguages = languages;
        this.availableTargetLanguages = this.supportedLanguages.filter(lang => !info.targetLangs.includes(lang.code));

        // Separate languages with extra features and other languages
        this.specialTargetLanguages = this.availableTargetLanguages
          .filter((lang) => Object.keys(this.languageFeatures).includes(lang.code))
          .sort((a, b) => a.name.localeCompare(b.name));

        this.otherTargetLanguages = this.availableTargetLanguages
          .filter((lang) => !Object.keys(this.languageFeatures).includes(lang.code))
          .sort((a, b) => a.name.localeCompare(b.name));
      })
    });

    // Update features when target languages change
    this.targetLanguageControl.valueChanges.subscribe(() => {
      this.updateSelectedFeatures();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
  onFluentLanguagesSelected(selectedLanguages: string[]): void {
    this.selectedFluentLanguages = selectedLanguages;
  }

  private filterTargetLanguages(search: string): Observable<string[][]> {
    const supportedLangNames = this.specialTargetLanguages
      .map(lang => lang.name)
      .filter(name => name.toLowerCase().includes(search.toLowerCase()));
    const otherLangNames = this.otherTargetLanguages
      .map(lang => lang.name)
      .filter(name => name.toLowerCase().includes(search.toLowerCase()));
    return of([supportedLangNames, otherLangNames]).pipe(delay(300)); // Simulate server delay if needed
  }

  updateSelectedFeatures(): void {
    const selectedLangNames = this.targetLanguageControl.value || [];
    const specialFeaturesMap: { [feature: string]: Set<string> } = {};
    const basicFeaturesMap: { [feature: string]: Set<string> } = {};

    selectedLangNames.forEach((langName) => {
      const lang = this.supportedLanguages.find((l) => l.name === langName);
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
      console.error('This should not happen: form is invalid but submit was called');
      return;
    }

    const targetLanguageNames = this.targetLanguageControl.value || [];
    const targetLanguageCodes = this.languageNameService.mapLanguageNamesToCodes(this.supportedLanguages, targetLanguageNames);
    if (this.mode === 'add-target') {
      let languageCode = targetLanguageCodes[0];

      this.languageApiService.addTargetLang(languageCode).subscribe({
        next: () => {

          const existingTargetLangs = this.userInfo?.targetLangs || [];
          const updatedLangs = [...existingTargetLangs, languageCode];
          this.userInfoService.updateUserInfo({targetLangs: updatedLangs});

          this.router.navigate(['/settings/lang'], {queryParams: {target_lang: "success"}}).then();
        },
        error: (error) => {
          this.alertService.open(error.error.message || 'Failed to add new target language', {appearance: 'error'}).subscribe();
          console.error('Error saving languages:', error);
        },
      });
      return;
    }
    const fluentLanguageNames = this.selectedFluentLanguages;
    const fluentLanguageCodes = this.languageNameService.mapLanguageNamesToCodes(this.supportedLanguages, fluentLanguageNames);

    const payload = {
      fluentLangs: fluentLanguageCodes,
      targetLangs: targetLanguageCodes,
    };

    this.languageApiService.saveUserLanguages(payload).subscribe({
      next: () => {
        // Redirect to /home
        this.router.navigate(['/home']).then(r => r);
        this.userInfoService.clearUserInfo();
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Failed to save your preferences', {appearance: 'error'}).subscribe();
        console.error('Error saving languages:', error);
      },
    });
  }
}
