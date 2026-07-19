import {getErrorMessage} from '../../shared/http-error';
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, TemplateRef, ViewChild, inject } from '@angular/core';
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
import {TuiChip, TuiInputChip, TuiInputChipDirective, TuiMultiSelectGroupComponent, TuiMultiSelectGroupDirective} from '@taiga-ui/kit/components';
import {TuiChevron} from '@taiga-ui/kit/directives';
import {TuiAutoColorPipe, TuiHideSelectedPipe} from '@taiga-ui/kit/pipes';
import {TuiDataList, TuiDataListComponent, TuiError, TuiNotificationService, TuiTextfieldMultiComponent} from '@taiga-ui/core/components';
import {TuiFilterByInputPipe} from '@taiga-ui/core/pipes';
import {TuiDropdownContent} from '@taiga-ui/core/portals';
import {TUI_VALIDATION_ERRORS} from '@taiga-ui/core/tokens';
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
import {TuiActiveZone, TuiItem} from "@taiga-ui/cdk/directives";
import {AsyncPipe, NgClass} from "@angular/common";
import {SharedLucideIconsModule} from "../../shared/shared-lucide-icons.module";
import {ButtonComponent} from "../../shared/button/button.component";

type CefrFormGroup = FormGroup<{
  language: FormControl<string>;
  cefrLevel: FormControl<CEFRLevel | null>;
}>;

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
    TuiError,
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
    TuiDropdownContent,
    TuiMultiSelectGroupDirective,
    TuiDataListComponent,
    TuiMultiSelectGroupComponent,
    TuiDataList,
    FormsModule,
    TuiHideSelectedPipe,
    TuiFilterByInputPipe,
    NgClass
  ]
})
export class LanguageSetupComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private languageApiService = inject(LanguageApiService);
  private onboardingService = inject(OnboardingService);
  private languageNameService = inject(LanguageNameService);
  private userInfoService = inject(UserInfoService);
  private alertService = inject(TuiNotificationService);
  private validationMessagesService = inject(ValidationMessagesService);
  private supportedLanguagesService = inject(SupportedLanguagesService);
  private popupTemplateStateService = inject(PopupTemplateStateService);
  private utilsService = inject(UtilsService);

  @ViewChild('langSetup', {static: true}) content!: TemplateRef<unknown>;
  private readonly destroy$ = new Subject<void>();
  private readonly step = SetupStep.LANGUAGES;

  @Output() continue = new EventEmitter<SetupStep>();
  @Input() embeddedMode = false;

  protected onSecondForm = false;

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
  languageFeatures: Record<string, string[]> = {
    EN: ['Lexemes', 'Frequency', 'Prepared Decks', 'Parts of Speech'],
    DE: ['Lexemes', 'Frequency', 'Prepared Decks'],
    // Add more if needed
  };

  cachedFluentLanguages: string[] = [];
  targetLanguagesControl = new FormControl<string[]>([], {nonNullable: true});

  // STEP 2. CEFR
  cefrForm!: FormGroup<{languages: FormArray<CefrFormGroup>}>;
  cefrLevels: CEFRLevel[] = Object.values(CEFRLevel);
  fluentFormValid = true;
  private cachedCefrLevels = new Map<string, CEFRLevel>();

  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();

  @ViewChild('targetInput', {static: true}) targetInput!: ElementRef<HTMLInputElement>;

  private allowedTarget = new Set<string>();
  protected targetMaxLanguages = 1;

  constructor() {
    this.languageForm = this.fb.group({
        targetLanguages: this.targetLanguagesControl,
      }, {validators: this.languageFormValidator()}
    );
    this.cefrForm = this.fb.group({
      languages: this.fb.array<CefrFormGroup>([])
    });

    this.filteredTargetLanguages$ = this.targetSearch$.pipe(
      startWith(''),
      debounceTime(200),
      distinctUntilChanged(),
      switchMap(search => this.filterTargetLanguages(search)),
    );
  }

  private languageFormValidator(): ValidatorFn {
    return (): ValidationErrors | null => {
      if (!this.fluentFormValid) {
        return {fluentLanguagesInvalid: true}; // Error if fluent form is invalid
      }
      return null; // No errors
    };
  }

  private cefrLevelValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as unknown;

      // Check if the value is a valid CEFR level
      const validLevels = Object.values(CEFRLevel);
      if (typeof value !== 'string' || !validLevels.includes(value as CEFRLevel)) {
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

  protected get languages(): FormArray<CefrFormGroup> {
    return this.cefrForm.controls.languages;
  }

  protected getCefrLevelControl(idx: number): FormControl<CEFRLevel | null> {
    return this.languages.at(idx).controls.cefrLevel;
  }

  private initializeCefrForm(learners: Learner[], targetLanguages: string[]): void {
    const formGroups = targetLanguages.map((languageName) => {
      // Map full language name back to code
      const languageCode = this.languageNameService.mapLanguageNameToCode(this.supportedLanguages, languageName);
      const learner = learners.find((l) => l.language === languageCode);

      return this.fb.group({
        language: this.fb.nonNullable.control(languageName, Validators.required),
        cefrLevel: new FormControl<CEFRLevel | null>(
          learner?.selfReportedLevel ?? null,
          [Validators.required, this.cefrLevelValidator()]
        ),
      });
    });

    this.cefrForm = this.fb.group({
      languages: this.fb.array(formGroups),
    });
  }

  private updateSelectedFeatures(): void {
    const selectedLangNames = this.targetLanguagesControl.value || [];
    const specialFeaturesMap: Record<string, Set<string>> = {};
    const basicFeaturesMap: Record<string, Set<string>> = {};

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
    const existingLevels = new Map<string, CEFRLevel>();
    formArray.controls.forEach((control) => {
      const language = control.get('language')?.value;
      const cefrLevel = control.get('cefrLevel')?.value;
      if (language && cefrLevel) {
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
          language: this.fb.nonNullable.control(language, Validators.required), // Read-only field for the language name
          cefrLevel: new FormControl<CEFRLevel | null>(
            (existingLevels.get(language) ?? this.cachedCefrLevels.get(language)) ?? null,
            [Validators.required, this.cefrLevelValidator()]
          ),
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

    return of([groupA, groupB]);
  }

  onTypeTarget(event: Event): void {
    if (this.atTargetLimit) return; // block typing when capped
    const value = (event.target as HTMLInputElement).value ?? '';
    this.targetSearch$.next(value);
  }


// block chip-creation keys; also block when capped
  trapSeparatorsTarget(e: KeyboardEvent): void {
    if (this.atTargetLimit) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const key = e.key;
    if (key === 'Enter' || key === ',' || key === ' ') {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  private _lastTargetFilteredGroups: string[][] | null = null;

  onEnterTarget(e: KeyboardEvent): void {
    if (this.atTargetLimit) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const groups = this._lastTargetFilteredGroups ?? [[], []]; // keep last if you store it
    const first = [...groups[0], ...groups[1]][0];
    if (first) this.onPickTarget(first);
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

  get atTargetLimit(): boolean {
    return (this.targetLanguagesControl.value?.length ?? 0) >= this.targetMaxLanguages;
  }

  protected submitFirstStepForm(): void {
    if (this.languageForm.invalid || !this.fluentFormValid) {
      this.alertService.open('Please fill in all required fields', {appearance: 'negative'}).subscribe();
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
        this.alertService.open('New target language added to your profile!', {appearance: 'positive'}).subscribe();
      },
      error: (error) => {
        console.error('Error saving languages:', error);
        this.alertService.open(getErrorMessage(error, 'Failed to add new target languages'), {appearance: 'negative'}).subscribe();
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
          this.alertService.open(getErrorMessage(error, 'Failed to save your preferences'), {appearance: 'negative'}).subscribe();
          console.error('Error saving languages:', error);
        },
      });
  }

  private prepareTargetLanguagesData(): TargetLanguageWithProficiency[] {
    return this.cefrForm.getRawValue().languages.map(entry => {
      if (!entry.cefrLevel) {
        throw new Error(`Missing CEFR level for ${entry.language}`);
      }
      const languageCode = this.languageNameService.mapLanguageNameToCode(this.supportedLanguages, entry.language);
      if (!languageCode) {
        throw new Error(`Unsupported language: ${entry.language}`);
      }
      this.cachedCefrLevels.set(entry.language, entry.cefrLevel); // Cache CEFR level
      return {
        language: languageCode,
        cefrLevel: entry.cefrLevel,
      };
    });
  }

  get isDataChanged(): boolean {
    const currentData = this.prepareTargetLanguagesData();
    const originalData = this.userInfo!.learners.map(learner => ({
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

  get specialTargetLanguageNames(): string[] {
    return this.specialTargetLanguages.map(l => l.name);
  }

  get otherTargetLanguageNames(): string[] {
    return this.otherTargetLanguages.map(l => l.name);
  }
}
