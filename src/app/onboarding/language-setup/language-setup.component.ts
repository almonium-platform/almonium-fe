import {logger} from "../../shared/logger";
import {getErrorMessage} from '../../shared/http-error';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, OnInit, Output, TemplateRef, ViewChild, inject } from '@angular/core';
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
import {TuiInputChip, TuiInputChipDirective} from '@taiga-ui/kit/components';
import {TuiChevron} from '@taiga-ui/kit/directives';
import {TuiDataList, TuiDataListComponent, TuiError, TuiNotificationService, TuiTextfieldMultiComponent} from '@taiga-ui/core/components';
import {TuiDropdownContent} from '@taiga-ui/core/portals';
import {TUI_VALIDATION_ERRORS} from '@taiga-ui/core/tokens';
import {BehaviorSubject, finalize, Observable, of, Subject, takeUntil} from 'rxjs';
import {debounceTime, distinctUntilChanged, startWith, switchMap} from 'rxjs/operators';
import {Language} from '../../models/language.model';
import {LanguageCode} from '../../models/language.enum';
import {LanguageApiService} from '../../services/language-api.service';
import {NgxParticlesModule} from "@tsparticles/angular";
import {UserInfoService} from "../../services/user-info.service";
import {LanguageNameService} from "../../services/language-name.service";
import {ValidationMessagesService} from "./validation-messages-service";
import {SupportedLanguagesService} from "../../services/supported-langs.service";
import {CEFRLevel, Learner, PlanLimitKeys, SetupStep, UserInfo} from "../../models/userinfo.model";
import {OnboardingService} from "../onboarding.service";
import {reconcileSubmittedLearnerLevels, TargetLanguageWithProficiency} from "./language-setup.model";
import {PopupTemplateStateService} from "../../shared/modals/popup-template/popup-template-state.service";
import {UtilsService} from "../../services/utils.service";
import {TuiItem} from "@taiga-ui/cdk/directives";
import {AsyncPipe, NgClass} from "@angular/common";
import {SharedLucideIconsModule} from "../../shared/shared-lucide-icons.module";
import {ButtonComponent} from "../../shared/button/button.component";
import {LANGUAGE_COLOURS} from "../../shared/language-colours";
import {TargetLanguageDropdownService} from "../../services/target-language-dropdown.service";

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
    SharedLucideIconsModule,
    ButtonComponent,
    AsyncPipe,
    TuiTextfieldMultiComponent,
    TuiChevron,
    TuiInputChipDirective,
    TuiInputChip,
    TuiItem,
    TuiDropdownContent,
    TuiDataListComponent,
    TuiDataList,
    FormsModule,
    NgClass,
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
  private targetLanguageDropdownService = inject(TargetLanguageDropdownService);

  @ViewChild('langSetup', {static: true}) content!: TemplateRef<unknown>;
  private readonly destroy$ = new Subject<void>();
  private readonly step = SetupStep.LANGUAGES;

  @Output() continue = new EventEmitter<SetupStep>();
  @Output() back = new EventEmitter<void>();
  /** The embedded sheet's plan upsell: the host swaps in the paywall rather than routing away under the dialog. */
  @Output() upgrade = new EventEmitter<void>();
  @Input() embeddedMode = false;

  protected onSecondForm = false;
  protected showAllLanguages = false;
  protected showNativeLanguageNote = false;

  protected userInfo: UserInfo | null = null;
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
  private languageColours: Record<string, string> = {};

  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();

  // NOTE: `content` (the #langSetup ng-template) is only ever instantiated by a
  // *different* component via ngTemplateOutlet (PopupTemplateComponent / OnboardingComponent),
  // so @ViewChild on this component can never see elements inside it. Any reference to the
  // input must come from a local template variable passed in from the template itself.

  private allowedTarget = new Set<string>();
  protected targetMaxLanguages = 1;
  protected totalTargetSlots = 1;
  protected existingTargetLanguageCount = 0;
  /** How many of the picks will start active. -1 is unlimited, and asks nothing of the reader. */
  protected activeAllowance = -1;
  protected fluentMaxLanguages = 3;

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
    this.targetLanguageDropdownService.langColors$
      .pipe(takeUntil(this.destroy$))
      .subscribe((colours) => this.languageColours = colours);

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

    this.supportedLanguagesService.supportedLanguages$.pipe(takeUntil(this.destroy$)).subscribe((languages) => {
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
        this.totalTargetSlots = limit;
        this.activeAllowance = this.userInfo.subscription.getLimit(PlanLimitKeys.MAX_ACTIVE_LANGS, -1);
        this.existingTargetLanguageCount = info.targetLangs.length;
        const availableSlots = this.embeddedMode ? Math.max(0, limit - info.targetLangs.length) : limit;
        setValidationForTargetLanguages.call(this, availableSlots);
        this.fluentMaxLanguages = this.userInfo.subscription.getMaxFluentLanguages();

        this.cachedFluentLanguages = info.fluentLangs.length
          ? this.languageNameService.mapLanguageCodesToNames(languages, info.fluentLangs)
          : this.detectNativeLanguage(languages);
        this.selectedFluentLanguages = this.cachedFluentLanguages;

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
    this.targetLanguagesControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
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
            (existingLevels.get(language) ?? this.cachedCefrLevels.get(language))
              ?? (this.embeddedMode ? CEFRLevel.A1 : null),
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
    if (first) this.onPickTarget(first, e.target as HTMLInputElement);
  }

  // `inputEl` must come from a local template variable (e.g. `#targetInput`), not @ViewChild:
  // this component's markup is only ever rendered elsewhere via ngTemplateOutlet, so @ViewChild
  // can never resolve elements from it.
  onPickTarget(item?: string, inputEl?: HTMLInputElement): void {
    if (!item || !this.allowedTarget.has(item)) return;

    const current = this.targetLanguagesControl.value ?? [];
    if (current.includes(item) || current.length >= this.targetMaxLanguages) return;

    this.targetLanguagesControl.setValue([...current, item]);

    // Taiga UI's textfield tracks the typed search text as separate internal state
    // (only synced from the native input's own 'input' event), so clearing the
    // FormControl value alone doesn't clear what's still shown in the box.
    if (inputEl) {
      inputEl.value = '';
      inputEl.dispatchEvent(new Event('input', {bubbles: true}));
    }
    this.targetSearch$.next('');
  }

  get atTargetLimit(): boolean {
    return (this.targetLanguagesControl.value?.length ?? 0) >= this.targetMaxLanguages;
  }

  /**
   * At the limit the remaining cards grey out. The line says what would free one up, so the grid reads as a rule
   * rather than as half the options having quietly stopped responding.
   */
  protected get targetLimitNote(): string {
    return this.targetMaxLanguages === 1
      ? 'One language to start. Deselect it to pick a different one.'
      : `That is all ${this.targetMaxLanguages} picks. Deselect one to choose another.`;
  }

  /**
   * What the account will do with the picks past the allowance, said before it does it rather than discovered
   * afterwards. Picking is free; only how many start active is bounded, and the order here is the order the backend
   * activates in, so the sentence names the language it will really pick.
   */
  protected get startsActiveNote(): string | null {
    const picked: string[] = this.targetLanguagesControl.value ?? [];
    if (this.activeAllowance < 0 || picked.length <= this.activeAllowance) {
      return null;
    }
    const starting = picked.slice(0, this.activeAllowance);
    const waiting = picked.length - this.activeAllowance;
    return `${this.joinNames(starting)} ${starting.length === 1 ? 'starts' : 'start'} active. `
      + `The other ${waiting === 1 ? 'one waits' : waiting + ' wait'} — kept in full, ready whenever you switch or upgrade.`;
  }

  private joinNames(names: string[]): string {
    if (names.length <= 1) return names[0] ?? '';
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
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

  protected returnToLanguageSelection(): void {
    this.onSecondForm = false;
  }

  protected submitOnboardingLanguageForm(): void {
    if (this.languageForm.invalid || this.loadingSubject$.getValue()) {
      return;
    }

    const fluentLanguageCodes = this.getFluentLangCodes();
    const targetLangsData = this.targetLanguagesControl.value.map((name) => {
      const language = this.languageNameService.mapLanguageNameToCode(this.supportedLanguages, name);
      if (!language) {
        throw new Error(`Unsupported target language: ${name}`);
      }
      return {language, cefrLevel: CEFRLevel.B1};
    });

    this.loadingSubject$.next(true);
    this.onboardingService.setupLanguages({fluentLangs: fluentLanguageCodes, targetLangsData})
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: (learners) => {
          this.userInfoService.updateUserInfo({
            fluentLangs: fluentLanguageCodes,
            learners,
            setupStep: SetupStep.LEVEL,
          });
        },
        error: (error) => {
          logger.error('Failed to save selected languages', error);
          this.alertService.open(getErrorMessage(error, 'Failed to save your language'), {appearance: 'negative'}).subscribe();
        },
      });
  }

  private handleAddNewTargetLangMode() {
    const payload: TargetLanguageWithProficiency[] = this.prepareTargetLanguagesData();

    this.languageApiService.setupLanguages(payload)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
      next: (learners: Learner[]) => {
        const reconciledLearners = reconcileSubmittedLearnerLevels(learners, payload);
        const colours = {...this.languageColours};
        payload.forEach((target, index) => {
          colours[target.language] ??= LANGUAGE_COLOURS[
            (this.existingTargetLanguageCount + index) % LANGUAGE_COLOURS.length
          ].hex;
        });
        this.targetLanguageDropdownService.setLanguageColors(colours);
        this.popupTemplateStateService.closeImmediately();
        this.userInfoService.updateUserInfo({learners: reconciledLearners});
        this.userInfoService.fetchUserInfoFromServer().subscribe();
        this.alertService.open('New target language added to your profile!', {appearance: 'positive'}).subscribe();
      },
      error: (error) => {
        logger.error('Error saving languages:', error);
        this.alertService.open(getErrorMessage(error, 'Failed to add new target languages'), {appearance: 'negative'}).subscribe();
      },
      });
  }

  protected submitSecondStepForm(): void {
    if (this.loadingSubject$.getValue()) {
      logger.warn('Submission already in progress. Skipping.');
      return;
    }

    if (this.cefrForm.invalid) {
      this.alertService.open('Pick a level for every language', {appearance: 'negative'}).subscribe();
      return;
    }

    if (!this.isDataChanged) {
      logger.info('No changes detected. Skipping request.');
      this.continue.emit(SetupStep.LEVEL);
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

          const nextStep = SetupStep.LEVEL;

          if (this.userInfo!.setupStep === this.step) {
            this.userInfoService.updateUserInfo({setupStep: nextStep});
          } else {
            this.continue.emit(nextStep);
          }
        },
        error: (error) => {
          this.alertService.open(getErrorMessage(error, 'Failed to save your preferences'), {appearance: 'negative'}).subscribe();
          logger.error('Error saving languages:', error);
        },
      });
  }

  private buildTargetLanguagesData(): TargetLanguageWithProficiency[] | null {
    const data: TargetLanguageWithProficiency[] = [];

    for (const entry of this.cefrForm.getRawValue().languages) {
      if (!entry.cefrLevel) {
        return null;
      }

      const languageCode = this.languageNameService.mapLanguageNameToCode(this.supportedLanguages, entry.language);
      if (!languageCode) {
        return null;
      }

      data.push({
        language: languageCode,
        cefrLevel: entry.cefrLevel,
      });
    }

    return data;
  }

  private prepareTargetLanguagesData(): TargetLanguageWithProficiency[] {
    const data = this.buildTargetLanguagesData();
    if (!data) {
      throw new Error('Cannot prepare target languages from an incomplete or unsupported CEFR form');
    }

    this.cefrForm.getRawValue().languages.forEach(entry => {
      if (entry.cefrLevel) {
        this.cachedCefrLevels.set(entry.language, entry.cefrLevel);
      }
    });

    return data;
  }

  get isDataChanged(): boolean {
    const currentData = this.buildTargetLanguagesData();
    if (!currentData || !this.userInfo) {
      return false;
    }

    const originalData = this.userInfo.learners.map(learner => ({
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

  protected get visibleTargetLanguages(): Language[] {
    const languages = this.orderTargetLanguages([...this.specialTargetLanguages, ...this.otherTargetLanguages]);
    return this.showAllLanguages ? languages : languages.slice(0, 6);
  }

  protected get remainingLanguageCount(): number {
    return Math.max(0, this.specialTargetLanguages.length + this.otherTargetLanguages.length - 6);
  }

  protected get detectedNativeLanguage(): string {
    return this.cachedFluentLanguages[0] ?? 'your browser language';
  }

  protected get usedTargetSlots(): number {
    return this.existingTargetLanguageCount + this.targetLanguagesControl.value.length;
  }

  protected getTargetLanguageColour(languageName: string, index: number): string {
    const code = this.languageNameService.mapLanguageNameToCode(this.supportedLanguages, languageName);
    return (code ? this.languageColours[code] : undefined)
      ?? LANGUAGE_COLOURS[(this.existingTargetLanguageCount + index) % LANGUAGE_COLOURS.length].hex;
  }

  protected isTargetSelected(name: string): boolean {
    return this.targetLanguagesControl.value.includes(name);
  }

  protected toggleTarget(name: string): void {
    const selected = this.targetLanguagesControl.value;
    if (selected.includes(name)) {
      this.targetLanguagesControl.setValue(selected.filter(language => language !== name));
      return;
    }
    if (selected.length < this.targetMaxLanguages) {
      this.targetLanguagesControl.setValue([...selected, name]);
    }
  }

  protected featuresFor(language: Language): string {
    const specialFeatures = this.languageFeatures[language.code];
    return specialFeatures?.length ? specialFeatures.join(' · ') : 'Core features';
  }

  protected hasSpecialFeatures(language: Language): boolean {
    return this.languageFeatures[language.code]?.length > 0;
  }

  protected selectedLanguageExplanation(): string {
    const selectedLanguage = this.visibleTargetLanguages.find(language => this.isTargetSelected(language.name));
    if (!selectedLanguage) {
      return 'Choose a language to see what it adds to your reading tools.';
    }
    const features = this.languageFeatures[selectedLanguage.code];
    return features?.length
      ? `${selectedLanguage.name} adds ${features.join(', ').toLowerCase()}.`
      : `${selectedLanguage.name} includes all the core reading tools.`;
  }

  private detectNativeLanguage(languages: Language[]): string[] {
    const locale = typeof navigator === 'undefined'
      ? null
      : navigator.language.split('-')[0].toUpperCase() as LanguageCode;
    const detected = languages.find(language => language.code === locale)?.name;
    const fallback = languages.find(language => language.code === LanguageCode.EN)?.name;
    return detected ? [detected] : fallback ? [fallback] : [];
  }

  private readonly preferredTargetLanguageCodes: LanguageCode[] = [
    LanguageCode.DE,
    LanguageCode.EN,
    LanguageCode.FR,
    LanguageCode.ES,
    LanguageCode.PL,
  ];

  private orderTargetLanguages(languages: Language[]): Language[] {
    return [...languages].sort((left, right) => {
      const leftIndex = this.preferredTargetLanguageCodes.indexOf(left.code);
      const rightIndex = this.preferredTargetLanguageCodes.indexOf(right.code);
      if (leftIndex !== -1 || rightIndex !== -1) {
        return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex)
          - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
      }
      return left.name.localeCompare(right.name);
    });
  }
}
