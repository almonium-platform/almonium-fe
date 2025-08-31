import {ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {FormControl, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import {SettingsTabsComponent} from "../tabs/settings-tabs.component";
import {
  FluentLanguageSelectorComponent
} from "../../../shared/fluent-language-selector/fluent-language-selector.component";
import {LanguageApiService} from "../../../services/language-api.service";
import {Language} from "../../../models/language.model";
import {UserInfoService} from "../../../services/user-info.service";
import {CEFRLevel, Learner, UserInfo} from "../../../models/userinfo.model";
import {EditButtonComponent} from "../../../shared/edit-button/edit-button.component";
import {LanguageNameService} from "../../../services/language-name.service";
import {
  TuiAlertService, TuiAutoColorPipe, TuiHintDirective, TuiIcon, TuiTextfieldComponent,
  TuiTextfieldDropdownDirective, TuiTextfieldOptionsDirective
} from "@taiga-ui/core";
import {AsyncPipe, NgClass} from "@angular/common";
import {TuiChip, TuiDataListWrapperComponent, TuiSelectDirective, TuiSwitch} from "@taiga-ui/kit";
import {BehaviorSubject, filter, finalize, Subject, takeUntil} from "rxjs";
import {LocalStorageService} from "../../../services/local-storage.service";
import {ConfirmModalComponent} from "../../../shared/modals/confirm-modal/confirm-modal.component";
import {TargetLanguageDropdownService} from "../../../services/target-language-dropdown.service";
import {LanguageCode} from "../../../models/language.enum";
import {ActivatedRoute} from "@angular/router";
import {UrlService} from "../../../services/url.service";
import {PremiumBadgedContentComponent} from "../../../shared/premium-badged-content/premium-badged-content.component";
import {RecentAuthGuardService} from "../../../authentication/auth/recent-auth-guard.service";
import {RecentAuthGuardComponent} from "../../../shared/recent-auth-guard/recent-auth-guard.component";
import {SupportedLanguagesService} from "../../../services/supported-langs.service";
import {LanguageSetupComponent} from "../../../onboarding/language-setup/language-setup.component";
import {PopupTemplateStateService} from "../../../shared/modals/popup-template/popup-template-state.service";
import {UtilsService} from "../../../services/utils.service";
import {CefrLevelSelectorComponent} from "../../../shared/cefr-input/cefr-level-selector.component";
import {distinctUntilChanged} from "rxjs/operators";
import {CefrComponent} from "../../../shared/cefr/cefr.component";
import {NgClickOutsideDirective} from "ng-click-outside2";
import {LucideAngularModule} from "lucide-angular";

@Component({
  selector: 'app-lang-settings',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    SettingsTabsComponent,
    FluentLanguageSelectorComponent,
    EditButtonComponent,
    TuiChip,
    AsyncPipe,
    TuiIcon,
    ConfirmModalComponent,
    TuiAutoColorPipe,
    PremiumBadgedContentComponent,
    RecentAuthGuardComponent,
    LanguageSetupComponent,
    TuiSwitch,
    CefrLevelSelectorComponent,
    CefrComponent,
    NgClickOutsideDirective,
    LucideAngularModule,
    TuiHintDirective,
    NgClass,
    TuiTextfieldComponent,
    TuiSelectDirective,
    TuiDataListWrapperComponent,
    TuiTextfieldDropdownDirective,
    TuiTextfieldOptionsDirective
  ],
  templateUrl: './lang-settings.component.html',
  styleUrl: './lang-settings.component.less'
})
export class LangSettingsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  @ViewChild(LanguageSetupComponent, {static: false}) languageSetupComponent!: LanguageSetupComponent;

  protected userInfo: UserInfo | null = null;
  protected languages: Language[] = [];

  // fluent languages
  protected selectedFluentLanguages: string[] = [];
  protected currentFluentLanguages: string[] = [];
  protected fluentEditable: boolean = false;
  protected fluentEnabled$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(true);
  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();

  // target languages
  protected targetLanguageNames: string[] = [];
  protected learners: Learner[] = [];
  protected cefrFormControl = new FormControl<CEFRLevel | null>(null, Validators.required);
  protected cefrEditable = false;
  protected addTargetLangModalVisible = false;
  protected targetLanguageSelectControl = new FormControl();
  protected showTargetLangDropdown = false;

  // TL deletion modal
  protected isConfirmTargetLangDeletionModalVisible: boolean = false;
  protected modalTitle = '';
  protected modalMessage = '';
  protected modalConfirmText = '';
  protected modalAction: (() => void) | null = null;

  constructor(
    private languageService: LanguageApiService,
    protected languageNameService: LanguageNameService,
    private userInfoService: UserInfoService,
    private alertService: TuiAlertService,
    private cdr: ChangeDetectorRef,
    private localStorageService: LocalStorageService,
    private languageApiService: LanguageApiService,
    private targetLanguageDropdownService: TargetLanguageDropdownService,
    private popupTemplateStateService: PopupTemplateStateService,
    private route: ActivatedRoute,
    private urlService: UrlService,
    private recentAuthGuardService: RecentAuthGuardService,
    private supportedLanguagesService: SupportedLanguagesService,
    private utilsService: UtilsService,
  ) {
  }

  ngOnInit(): void {
    this.popupTemplateStateService.drawerState$
      .pipe(
        takeUntil(this.destroy$),
        filter((state) => state.type === 'add-target-lang' && !state.visible)
      ).subscribe(() => {
      this.addTargetLangModalVisible = false;
      this.cdr.detectChanges();
    });

    this.route.queryParams.subscribe((params) => {
      if (params['target_lang'] === 'success') {
        this.alertService.open('Your target language has been successfully saved', {appearance: 'success'}).subscribe();
        this.urlService.clearUrl();
      }

      if (params['intent'] === 'reauth') {
        this.recentAuthGuardService.updateStatusAndShowAlert();
        this.urlService.clearUrl();
      }
    });

    this.supportedLanguagesService.supportedLanguages$.subscribe((languages) => {
      if (languages) {
        this.languages = languages;
        this.populateFromUserInfo();
      }
    });

    this.cefrFormControl.valueChanges
      .pipe(
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((newValue) => {
        if (!newValue) return;
        this.saveCefrLevelToServer(newValue);
        this.cefrEditable = false;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private populateFromUserInfo() {
    this.userInfoService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe((info: UserInfo | null) => {

      if (info) {
        this.userInfo = info;
        this.selectedFluentLanguages = info.fluentLangs;
        this.currentFluentLanguages = this.languageNameService.mapLanguageCodesToNames(this.languages, info.fluentLangs);
        this.targetLanguageNames = this.languageNameService.mapLanguageCodesToNames(this.languages, info.targetLangs);
        this.targetLanguageSelectControl = new FormControl(this.targetLanguageNames[0]);
        this.learners = info.learners;
        this.updateFluentEnabled();
        this.patchCefrControlFromCurrentLearner();
      }
    });
  }

  private patchCefrControlFromCurrentLearner(): void {
    const learner = this.currentLearner;
    if (!learner) {
      this.cefrFormControl.patchValue(null, {emitEvent: false});
      return;
    }
    this.cefrFormControl.patchValue(
      learner.selfReportedLevel as CEFRLevel,
      {emitEvent: false} // so we don’t fire the .valueChanges subscription immediately
    );
  }

  private saveCefrLevelToServer(newValue: CEFRLevel): void {
    const oldValue = this.currentLearner.selfReportedLevel;
    this.currentLearner.selfReportedLevel = newValue;

    this.languageApiService.updateLearner(this.currentLearner.language, {level: newValue}).subscribe({
      next: () => {
        this.userInfoService.updateUserInfo({learners: this.learners});
      },
      error: (err) => {
        console.error('Failed to update CEFR:', err);
        this.alertService.open('Failed to update CEFR level', {appearance: 'error'}).subscribe();
        this.currentLearner.selfReportedLevel = oldValue;
      },
    });
  }

  get currentLearner(): Learner {
    const selectedLanguageName = this.targetLanguageSelectControl.value;
    const selectedLanguageCode = this.languageNameService.mapLanguageNameToCode(this.languages, selectedLanguageName);

    const learner = this.learners.find((learner) => learner.language === selectedLanguageCode);
    if (!learner) {
      console.error(`Learner not found for ${selectedLanguageCode}`);
    }
    return learner!;
  }

  private validateFluentLanguages() {
    return this.selectedFluentLanguages.length <= 3 && this.selectedFluentLanguages.length > 0;
  }

  private updateFluentEnabled(): void {
    const isEnabled =
      !this.fluentEditable ||
      (this.validateFluentLanguages() && !this.utilsService.areArraysEqual(this.selectedFluentLanguages, this.currentFluentLanguages, (a, b) => a === b));

    Promise.resolve().then(() => {
      this.fluentEnabled$.next(isEnabled);
      this.cdr.detectChanges();
    });
  }

  protected onFluentLanguagesSelected(state: { languages: string[]; valid: boolean }): void {
    this.selectedFluentLanguages = state.languages;
    // TODO validity check
    this.updateFluentEnabled();
  }

  protected onFluentEdit(): void {
    if (!this.fluentEditable) {
      this.fluentEditable = true;
      this.updateFluentEnabled();
      return;
    }

    if (!this.fluentEnabled$) {
      console.error('This should not happen: form is invalid but submit was called');
      return;
    }

    this.loadingSubject$.next(true);

    const fluentLanguageCodes = this.languageNameService.mapLanguageNamesToCodes(this.languages, this.selectedFluentLanguages);
    this.languageService.saveFluentLanguages({
      langCodes: fluentLanguageCodes,
    }).pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: () => {
          this.alertService.open('Fluent languages saved', {appearance: 'success'}).subscribe();
          this.localStorageService.clearUserInfo();
          this.fluentEditable = false;
          this.currentFluentLanguages = this.selectedFluentLanguages;
        },
        error: (error) => {
          this.alertService.open(error.error.message || 'Failed to save fluent languages', {appearance: 'error'}).subscribe();
          this.restoreFluent();
        },
      });
  }

  private restoreFluent() {
    this.fluentEditable = false;
    this.selectedFluentLanguages = this.currentFluentLanguages;
  }


  // TARGET
  protected deleteTargetLang() {
    this.restoreFluent();
    if (this.learners.length === 1) {
      console.error("This should not happen: trying to delete the last target language");
      return;
    }
    this.recentAuthGuardService.guardAction(() => {
      this.prepareTargetLangDeletionModal();
    });
  }

  protected getCurrentTargetLanguageName() {
    return this.targetLanguageSelectControl.value;
  }

  private prepareTargetLangDeletionModal() {
    this.modalTitle = 'Delete ' + this.getCurrentTargetLanguageName() + ' Profile';
    this.modalMessage = 'Are you sure? All your cards, progress, and settings will be lost.';
    this.modalConfirmText = 'Delete';
    this.modalAction = this.confirmTargetLangDeletion.bind(this);
    this.isConfirmTargetLangDeletionModalVisible = true;
  }

  protected closeTargetLangDeletionConfirmModal() {
    this.isConfirmTargetLangDeletionModalVisible = false;
  }

  protected confirmTargetLangDeletion() {
    const deletedLanguageName = this.targetLanguageSelectControl.value;
    const deletedLanguageCode = this.languageNameService.mapLanguageNameToCode(this.languages, deletedLanguageName);

    if (!deletedLanguageCode) {
      console.error(`Language code not found for ${deletedLanguageName}`);
      return;
    }

    this.languageApiService.deleteLearner(deletedLanguageCode).subscribe({
      next: () => {
        this.alertService
          .open(`Your ${deletedLanguageName} profile has been deleted`, {appearance: 'success'})
          .subscribe();

        // Remove from UI list
        this.targetLanguageNames = this.targetLanguageNames.filter(lang => lang !== deletedLanguageName);

        // Reset selection to the first available language
        this.targetLanguageSelectControl.setValue(this.targetLanguageNames.length ? this.targetLanguageNames[0] : null);

        // Remove from service and update user info
        this.targetLanguageDropdownService.removeTargetLanguage(deletedLanguageCode);
        this.userInfoService.updateUserInfo({
          learners: this.userInfo?.learners.filter(learner => learner.language !== deletedLanguageCode)
        });
      },
      error: (error) => {
        this.alertService
          .open(error.error.message || 'Failed to delete your target language', {appearance: 'error'})
          .subscribe();
      },
    });
  }

  protected openLangSetupPopup() {
    this.addTargetLangModalVisible = true;
    setTimeout(() => {
      this.popupTemplateStateService.open(this.languageSetupComponent.content, 'add-target-lang', true, true);
    }, 50);
  }

  protected activeToggleDisabled(): boolean {
    return this.currentLearner.active && this.getActiveLearnersCount() === 1;
  }

  protected getActiveLearnersCount(): number {
    return this.learners.filter((learner) => learner.active).length;
  }

  protected onToggleActiveStatus(active: boolean, languageCode: LanguageCode): void {
    if (!active && this.getActiveLearnersCount() === 1) {
      this.alertService.open('You must have at least one active target language', {appearance: 'error'}).subscribe();
      return;
    }

    this.currentLearner.active = active;

    this.languageApiService.updateLearner(languageCode, {active: active}).subscribe({
      next: () => {
        this.userInfoService.updateUserInfo({learners: this.learners});
        if (!active) {
          this.targetLanguageDropdownService.removeTargetLanguage(languageCode);
        } else {
          this.targetLanguageDropdownService.initializeLanguages(this.userInfo!);
        }
      },
      error: (err) => {
        this.alertService.open(err.error.message || 'Failed to update active status', {appearance: 'error'}).subscribe();
        this.currentLearner.active = !active;
      },
    });
  }

  protected handleClickOutsideCefrSelector() {
    if (this.cefrEditable) {
      this.cefrEditable = false;
    }
  }

  protected clickOnCefrBadge() {
    setTimeout(() => {
      this.cefrEditable = true;
    }, 0);
  }

  protected getActiveToggleTooltip(): string {
    if (this.getActiveLearnersCount() === 1 && this.currentLearner.active) {
      return 'You must have at least one active target language';
    }
    if (this.currentLearner.active) {
      return 'Deactivating language removes it from the navbar dropdown';
    }
    return 'Activating language adds it to the navbar dropdown';
  }

  get isDeleteTargetLangButtonVisible() {
    return this.learners.filter((learner) => learner.active).length > 1;
  }
}
