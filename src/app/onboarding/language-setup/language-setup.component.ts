import {TuiMultiSelectModule, TuiSelectModule, TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {ChangeDetectionStrategy, Component, EventEmitter, OnDestroy, OnInit, Output} from '@angular/core';
import {
  AbstractControl,
  FormArray,
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
import {TUI_VALIDATION_ERRORS, TuiChip, TuiDataListWrapper, TuiFieldErrorPipe} from '@taiga-ui/kit';
import {TuiAlertService, TuiAutoColorPipe, TuiError} from '@taiga-ui/core';
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
import {getNextStep, Learner, SetupStep, UserInfo} from "../../models/userinfo.model";
import {OnboardingService} from "../onboarding.service";
import {LucideIconsModule} from "./lucide-icons.module";
import {InfoIconComponent} from "../../shared/info-button/info-button.component";
import {LanguageCode} from "../../models/language.enum";


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
    TuiAutoColorPipe,
    TuiChip,
    LucideIconsModule,
    InfoIconComponent,
  ]
})
export class LanguageSetupComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly step = SetupStep.LANGUAGES;

  @Output() continue = new EventEmitter<SetupStep>();

  protected onSecondForm: boolean = false;

  private userInfo: UserInfo | null = null;
  languageForm: FormGroup;
  supportedLanguages: Language[] = [];
  availableTargetLanguages: Language[] = [];
  specialTargetLanguages: Language[] = [];
  otherTargetLanguages: Language[] = [];
  selectedFluentLanguages: string[] = [];

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
    EN: ['Lexemes', 'Frequency', 'Prepared Decks', 'Parts of Speech'],
    DE: ['Lexemes', 'Frequency', 'Prepared Decks'],
    // Add more if needed
  };

  protected mode: 'add-target' | 'default' = 'default';

  cachedFluentLanguages: string[] = [];
  targetLanguageControl = new FormControl<string[]>([], []);

  // STEP 2. CEFR
  cefrForm!: FormGroup;
  // todo enum
  cefrLevels: string[] = [
    'A1',
    'A2',
    'B1',
    'B2',
    'C1',
    'C2',
  ];
  fluentFormValid: boolean = true;
  private cachedCefrLevels = new Map<string, string>();

  constructor(
    private fb: FormBuilder,
    private languageApiService: LanguageApiService,
    private onboardingService: OnboardingService,
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
      }, {validators: this.languageFormValidator()}
    );
    this.cefrForm = this.fb.group({
      languages: this.fb.array([])
    });

    this.filteredTargetLanguages$ = this.targetSearch$.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((search) => this.filterTargetLanguages(search))
    );
  }

  private languageFormValidator(): ValidatorFn {
    return (_: AbstractControl): ValidationErrors | null => {
      if (!this.fluentFormValid) {
        return {fluentLanguagesInvalid: true}; // Error if fluent form is invalid
      }
      return null; // No errors
    };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    const setValidationForTargetLanguages = (maxLanguages: number) => {
      this.validationMessagesService.setMaxLanguages(maxLanguages);

      // Update validators dynamically
      this.targetLanguageControl.setValidators([
        Validators.required,
        this.maxLanguagesValidator(maxLanguages),
      ]);
      this.targetLanguageControl.updateValueAndValidity();
    }

    this.route.queryParams.subscribe((params) => {
      if (params['mode'] === 'add-target') {
        this.mode = 'add-target';
        setValidationForTargetLanguages.call(this, 1);
        this.initializeCefrFormEmpty();
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

        if (this.mode !== 'add-target') {
          const limit = this.userInfo.subscription.getMaxTargetLanguages();
          setValidationForTargetLanguages.call(this, limit);
          this.cachedFluentLanguages = this.languageNameService.mapLanguageCodesToNames(languages, info.fluentLangs);
          const targetLangNames = this.languageNameService.mapLanguageCodesToNames(languages, info.targetLangs);
          this.targetLanguageControl.setValue(targetLangNames);
          this.initializeCefrForm(info.learners, targetLangNames);
        }

        if (this.mode == 'add-target' && info.targetLangs.length > 0) {
          this.availableTargetLanguages = this.supportedLanguages.filter(lang => !info.targetLangs.includes(lang.code));
        } else {
          this.availableTargetLanguages = this.supportedLanguages;
        }

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
      const selectedLangNames = this.targetLanguageControl.value || [];
      this.updateCefrForm(selectedLangNames);
    });
  }

  private get languages(): FormArray {
    return this.cefrForm.get('languages') as FormArray;
  }

  private initializeCefrForm(learners: Learner[], targetLanguages: string[]): void {
    const formGroups = targetLanguages.map((languageName) => {
      // Map full language name back to code
      const languageCode = this.languageNameService.mapLanguageNameToCode(this.supportedLanguages, languageName);
      const learner = learners.find((l) => l.language === languageCode);

      return this.fb.group({
        language: [languageName, Validators.required], // Use full name for display
        cefrLevel: [learner?.selfReportedLevel || '', Validators.required], // Pre-fill CEFR level if available
      });
    });

    this.cefrForm = this.fb.group({
      languages: this.fb.array(formGroups),
    });
  }

  private initializeCefrFormEmpty(): void {
    const selectedLanguages = this.targetLanguageControl.value || [];
    this.cefrForm = this.fb.group({
      languages: this.fb.array(
        selectedLanguages.map((language: string) =>
          this.fb.group({
            language: [language, Validators.required],
            cefrLevel: ['', Validators.required],
          })
        )
      ),
    });
  }

  private updateSelectedFeatures(): void {
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

  private updateCefrForm(targetLanguages: string[]): void {
    const formArray = this.languages;

    // Create a map of existing languages and their CEFR levels
    const existingLevels = new Map<string, string>();
    formArray.controls.forEach((control) => {
      const language = control.get('language')?.value;
      const cefrLevel = control.get('cefrLevel')?.value;
      if (language) {
        existingLevels.set(language, cefrLevel);
        this.cachedCefrLevels.set(language, cefrLevel); // Cache the CEFR level
      }
    });

    // Clear existing form controls to avoid duplication
    formArray.clear();

    // Add a new form group for each target language
    targetLanguages.forEach((language) => {
      formArray.push(
        this.fb.group({
          language: [language], // Read-only field for the language name
          cefrLevel: [
            existingLevels.get(language) || this.cachedCefrLevels.get(language) || '',
            Validators.required,
          ], // Retain CEFR level if available
        })
      );
    });
  }

  private maxLanguagesValidator(max: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as string[] | null;
      if (value && value.length > max) {
        return {maxLanguages: true}; // Return a simple error flag
      }
      return null;
    };
  }

  protected listenToFluentForm(state: { languages: string[]; valid: boolean }): void {
    this.selectedFluentLanguages = state.languages;
    this.fluentFormValid = state.valid;
    this.languageForm.updateValueAndValidity();
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

  protected submitFirstStepForm(): void {
    if (this.languageForm.invalid || !this.fluentFormValid) {
      this.alertService.open('Please fill in all required fields', {appearance: 'error'}).subscribe();
      return;
    }

    if (this.onSecondForm) {
      console.error('This should not happen');
      return;
    }

    const targetLanguageCodes = this.getTargetLangCodes();

    if (this.mode === 'add-target') {
      this.handleAddNewTargetLangMode(targetLanguageCodes);
      return;
    }

    this.onSecondForm = true
    this.cachedFluentLanguages = this.selectedFluentLanguages;
    return;
  }

  private handleAddNewTargetLangMode(targetLanguageCodes: LanguageCode[]) {
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
  }

  protected submitSecondStepForm(): void {
    if (this.cefrForm.invalid) {
      console.error('Form is invalid. Please fill in all fields.');
      return;
    }

    const fluentLanguageCodes = this.getFluentLangCodes();

    const submittedData = {
      fluentLangs: fluentLanguageCodes,
      targetLangsData: this.cefrForm.value.languages.map((entry: any) => {
        const languageCode = this.languageNameService.mapLanguageNameToCode(this.supportedLanguages, entry.language);
        this.cachedCefrLevels.set(entry.language, entry.cefrLevel); // Cache CEFR level
        return {
          language: languageCode,
          cefrLevel: entry.cefrLevel,
        };
      }),
    };

    // Send data to the backend
    this.onboardingService.setupLanguages(submittedData).subscribe({
      next: (learners: Learner[]) => {
        this.userInfoService.updateUserInfo({
          fluentLangs: fluentLanguageCodes,
          learners: learners,
        });

        const nextStep = getNextStep(this.step);

        if (this.userInfo!.setupStep <= this.step) {
          this.userInfoService.updateUserInfo({setupStep: nextStep});
        } else {
          this.continue.emit(nextStep);
        }
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Failed to save your preferences', {appearance: 'error'}).subscribe();
        console.error('Error saving languages:', error);
      },
    });
  }

  private getFluentLangCodes() {
    const fluentLanguageNames = this.selectedFluentLanguages;
    return this.languageNameService.mapLanguageNamesToCodes(this.supportedLanguages, fluentLanguageNames);
  }

  private getTargetLangCodes() {
    const targetLanguageNames = this.targetLanguageControl.value || [];
    return this.languageNameService.mapLanguageNamesToCodes(this.supportedLanguages, targetLanguageNames);
  }

  protected featuresVisible(): boolean {
    return this.selectedTargetLanguageFeatures.special.length > 0 || this.selectedTargetLanguageFeatures.basic.length > 0;
  }
}
