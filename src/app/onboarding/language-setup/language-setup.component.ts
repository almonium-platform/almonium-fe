import {TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  TemplateRef,
  ViewChild
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {
  TUI_VALIDATION_ERRORS,
  TuiChevron,
  TuiChip,
  TuiFieldErrorPipe, TuiFilterByInputPipe, TuiHideSelectedPipe,
  TuiInputChip,
  TuiInputChipDirective,
  TuiMultiSelectGroupComponent,
  TuiMultiSelectGroupDirective
} from '@taiga-ui/kit';
import {
  TuiAlertService,
  TuiAutoColorPipe,
  TuiDataList,
  TuiDataListComponent,
  TuiError,
  TuiTextfieldDropdownDirective,
  TuiTextfieldMultiComponent
} from '@taiga-ui/core';
import {BehaviorSubject, finalize, Observable, of, Subject, takeUntil} from 'rxjs';
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
import {CEFRLevel, getNextStep, Learner, SetupStep, UserInfo} from "../../models/userinfo.model";
import {OnboardingService} from "../onboarding.service";
import {InfoIconComponent} from "../../shared/info-button/info-button.component";
import {TargetLanguageWithProficiency} from "./language-setup.model";
import {PopupTemplateStateService} from "../../shared/modals/popup-template/popup-template-state.service";
import {UtilsService} from "../../services/utils.service";
import {CefrLevelSelectorComponent} from "../../shared/cefr-input/cefr-level-selector.component";
import {TuiActiveZone, TuiItem} from "@taiga-ui/cdk";
import {AsyncPipe} from "@angular/common";
import {SharedLucideIconsModule} from "../../shared/shared-lucide-icons.module";
import {ButtonComponent} from "../../shared/button/button.component";


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
    TuiTextfieldControllerModule,
    TuiError,
    TuiFieldErrorPipe,
    NgxParticlesModule,
    FluentLanguageSelectorComponent,
    TuiAutoColorPipe,
    TuiChip,
    SharedLucideIconsModule,
    InfoIconComponent,
    ButtonComponent,
    CefrLevelSelectorComponent,
    TuiActiveZone,
    AsyncPipe,
    TuiTextfieldMultiComponent,
    TuiChevron,
    TuiInputChipDirective,
    TuiInputChip,
    TuiItem,
    TuiTextfieldDropdownDirective,
    TuiMultiSelectGroupDirective,
    TuiDataListComponent,
    TuiMultiSelectGroupComponent,
    TuiDataList,
    FormsModule,
    TuiHideSelectedPipe,
    TuiFilterByInputPipe
  ]
})
export class LanguageSetupComponent implements OnInit, OnDestroy {
  @ViewChild('langSetup', {static: true}) content!: TemplateRef<any>;
  private readonly destroy$ = new Subject<void>();
  private readonly step = SetupStep.LANGUAGES;

  @Output() continue = new EventEmitter<SetupStep>();
  @Input() embeddedMode: boolean = false;

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

  cachedFluentLanguages: string[] = [];
  targetLanguagesControl = new FormControl<string[]>([], {nonNullable: true});

  // STEP 2. CEFR
  cefrForm!: FormGroup;
  cefrLevels: CEFRLevel[] = Object.values(CEFRLevel);
  fluentFormValid: boolean = true;
  private cachedCefrLevels = new Map<string, string>();

  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();

  @ViewChild('targetInput', {static: true}) targetInput!: ElementRef<HTMLInputElement>;

  private allowedTarget = new Set<string>();
  private lastFilteredTarget: string[] = []; // flattened for Enter
  private targetMaxLanguages = 1;

  constructor(
    private fb: FormBuilder,
    private languageApiService: LanguageApiService,
    private onboardingService: OnboardingService,
    private languageNameService: LanguageNameService,
    private userInfoService: UserInfoService,
    private alertService: TuiAlertService,
    private validationMessagesService: ValidationMessagesService,
    private supportedLanguagesService: SupportedLanguagesService,
    private popupTemplateStateService: PopupTemplateStateService,
    private utilsService: UtilsService,
  ) {
    this.languageForm = this.fb.group({
        targetLanguages: this.targetLanguagesControl,
      }, {validators: this.languageFormValidator()}
    );
    this.cefrForm = this.fb.group({
      languages: this.fb.array([])
    });

    this.filteredTargetLanguages$ = this.targetSearch$.pipe(
      startWith(''),
      debounceTime(200),
      distinctUntilChanged(),
      switchMap(search => this.filterTargetLanguages(search)),
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

  private cefrLevelValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;

      // Check if the value is a valid CEFR level
      const validLevels = Object.values(CEFRLevel);
      if (!validLevels.includes(value)) {
        return {invalidCefrLevel: true};
      }

      return null; // No error
    };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    const setValidationForTargetLanguages = (maxLanguages: number) => {
      this.targetMaxLanguages = maxLanguages;
      this.validationMessagesService.setMaxLanguages(maxLanguages);

      // Update validators dynamically
      this.targetLanguagesControl.setValidators([
        Validators.required,
        this.maxLanguagesValidator(maxLanguages),
      ]);
      this.targetLanguagesControl.updateValueAndValidity();
    }

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

        const limit = this.userInfo.subscription.getMaxTargetLanguages();
        setValidationForTargetLanguages.call(this, limit);

        this.cachedFluentLanguages = this.languageNameService.mapLanguageCodesToNames(languages, info.fluentLangs);

        const targetLangNames = this.languageNameService.mapLanguageCodesToNames(languages, info.targetLangs);
        this.targetLanguagesControl.setValue(this.embeddedMode ? [] : targetLangNames);
        this.initializeCefrForm(info.learners, targetLangNames);

        if (this.embeddedMode && info.targetLangs.length > 0) {
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

        this.allowedTarget = new Set(
          [...this.specialTargetLanguages, ...this.otherTargetLanguages].map(l => l.name)
        );

        // sanitize current control after (re)building allowed list
        this.sanitizeTargetControl();

      })
    });

    // Update features when target languages change
    this.targetLanguagesControl.valueChanges.subscribe(() => {
      this.sanitizeTargetControl();            // drop free-text / over-limit
      this.updateSelectedFeatures();
      const selectedLangNames = this.targetLanguagesControl.value || [];
      this.updateCefrForm(selectedLangNames);
    });
  }

  private sanitizeTargetControl(): void {
    const raw = this.targetLanguagesControl.value ?? [];
    const cleaned: string[] = [];

    for (const v of raw) {
      if (this.allowedTarget.has(v) && !cleaned.includes(v)) {
        cleaned.push(v);
        if (cleaned.length >= this.targetMaxLanguages) break; // enforce cap
      }
    }

    // write back only if changed to avoid loops
    const changed =
      raw.length !== cleaned.length || raw.some((v, i) => v !== cleaned[i]);

    if (changed) {
      this.targetLanguagesControl.setValue(cleaned, {emitEvent: false});
    }
  }

  protected get languages(): FormArray {
    return this.cefrForm.get('languages') as FormArray;
  }

  protected getCefrLevelControl(idx: number): FormControl {
    return this.languages.at(idx).get('cefrLevel') as FormControl;
  }

  private initializeCefrForm(learners: Learner[], targetLanguages: string[]): void {
    const formGroups = targetLanguages.map((languageName) => {
      // Map full language name back to code
      const languageCode = this.languageNameService.mapLanguageNameToCode(this.supportedLanguages, languageName);
      const learner = learners.find((l) => l.language === languageCode);

      return this.fb.group({
        language: [languageName, Validators.required],
        cefrLevel: [
          learner?.selfReportedLevel || null,
          [Validators.required, this.cefrLevelValidator()],
        ],
      });
    });

    this.cefrForm = this.fb.group({
      languages: this.fb.array(formGroups),
    });
  }

  private updateSelectedFeatures(): void {
    const selectedLangNames = this.targetLanguagesControl.value || [];
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
          language: [language, Validators.required], // Read-only field for the language name
          cefrLevel: [
            existingLevels.get(language) || this.cachedCefrLevels.get(language) || null,
            [Validators.required, this.cefrLevelValidator()],
          ],
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
    const q = search.toLowerCase().trim();
    const selected = new Set(this.targetLanguagesControl.value ?? []);

    const filt = (arr: Language[]) =>
      arr
        .map(l => l.name)
        .filter(name => !selected.has(name))
        .filter(name => (q ? name.toLowerCase().includes(q) : true));

    const groupA = filt(this.specialTargetLanguages);
    const groupB = filt(this.otherTargetLanguages);

    // keep a flat list for Enter behavior (groupA first)
    this.lastFilteredTarget = [...groupA, ...groupB];

    return of([groupA, groupB]);
  }

  onTypeTarget(event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.targetSearch$.next(value);
  }

  trapSeparatorsTarget(e: KeyboardEvent): void {
    const key = e.key;
    if (key === 'Enter' || key === ',' || key === ' ') {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  onEnterTarget(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopPropagation();
    if (this.lastFilteredTarget.length) {
      this.onPickTarget(this.lastFilteredTarget[0]);
    }
  }

  onPickTarget(item?: string): void {
    if (!item || !this.allowedTarget.has(item)) return;

    const current = this.targetLanguagesControl.value ?? [];
    if (current.includes(item) || current.length >= this.targetMaxLanguages) return;

    this.targetLanguagesControl.setValue([...current, item]);

    // clear typed text
    queueMicrotask(() => {
      if (this.targetInput?.nativeElement) {
        this.targetInput.nativeElement.value = '';
      }
    });
    this.targetSearch$.next('');
  }

  protected submitFirstStepForm(): void {
    if (this.languageForm.invalid || !this.fluentFormValid) {
      this.alertService.open('Please fill in all required fields', {appearance: 'error'}).subscribe();
      return;
    }

    this.onSecondForm = true;
    this.cachedFluentLanguages = this.selectedFluentLanguages;
    return;
  }

  private handleAddNewTargetLangMode() {
    const payload: TargetLanguageWithProficiency[] = this.prepareTargetLanguagesData();

    this.languageApiService.setupLanguages(payload).subscribe({
      next: (learners: Learner[]) => {
        this.popupTemplateStateService.close();
        setTimeout(() => {
          // if no delay, for a split second, until popup is truly closed, user sees too many entries on second step
          this.userInfoService.updateUserInfo({learners: learners});
        }, 200);
        this.alertService.open('New target language added to your profile!', {appearance: 'success'}).subscribe();
      },
      error: (error) => {
        console.error('Error saving languages:', error);
        this.alertService.open(error.error.message || 'Failed to add new target languages', {appearance: 'error'}).subscribe();
      },
    });
  }

  protected submitSecondStepForm(): void {
    if (this.loadingSubject$.getValue()) {
      console.warn('Submission already in progress. Skipping.');
      return;
    }

    if (this.cefrForm.invalid) {
      console.error('Form is invalid. Please fill in all fields.');
      return;
    }

    if (!this.isDataChanged) {
      console.info('No changes detected. Skipping request.');
      this.continue.emit(getNextStep(this.step));
      return;
    }

    this.loadingSubject$.next(true);

    if (this.embeddedMode) {
      this.handleAddNewTargetLangMode();
      return;
    }

    const fluentLanguageCodes = this.getFluentLangCodes();

    const submittedData = {
      fluentLangs: fluentLanguageCodes,
      targetLangsData: this.prepareTargetLanguagesData(),
    };

    // Send data to the backend
    this.onboardingService.setupLanguages(submittedData)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
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

  private prepareTargetLanguagesData(): { language: string; cefrLevel: string }[] {
    return this.cefrForm.value.languages.map((entry: any) => {
      const languageCode = this.languageNameService.mapLanguageNameToCode(this.supportedLanguages, entry.language);
      this.cachedCefrLevels.set(entry.language, entry.cefrLevel); // Cache CEFR level
      return {
        language: languageCode,
        cefrLevel: entry.cefrLevel,
      };
    });
  }

  get isDataChanged(): boolean {
    const currentData = this.prepareTargetLanguagesData();
    const originalData = this.userInfo!.learners.map((learner: any) => ({
      language: learner.language,
      cefrLevel: learner.selfReportedLevel,
    }));
    return !this.utilsService.areArraysEqual(currentData, originalData, (a, b) => a.language === b.language && a.cefrLevel === b.cefrLevel);
  }

  private getFluentLangCodes() {
    const fluentLanguageNames = this.selectedFluentLanguages;
    return this.languageNameService.mapLanguageNamesToCodes(this.supportedLanguages, fluentLanguageNames);
  }

  protected featuresVisible(): boolean {
    return this.selectedTargetLanguageFeatures.special.length > 0 || this.selectedTargetLanguageFeatures.basic.length > 0;
  }

  protected onActiveZoneChange($event: boolean) {
    if ($event) return;
    this.popupTemplateStateService.close();
  }

  get specialTargetLanguageNames(): string[] {
    return this.specialTargetLanguages.map(l => l.name);
  }

  get otherTargetLanguageNames(): string[] {
    return this.otherTargetLanguages.map(l => l.name);
  }
}
