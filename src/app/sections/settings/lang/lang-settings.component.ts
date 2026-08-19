import {logger} from "../../../shared/logger";
import {getErrorMessage} from '../../../shared/http-error';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import {FormControl, FormsModule} from "@angular/forms";
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
import {TuiIcon, TuiNotificationService} from "@taiga-ui/core/components";
import {TuiHintDirective} from "@taiga-ui/core/portals";
import {AsyncPipe} from "@angular/common";
import {TuiSwitch} from "@taiga-ui/kit/components";
import {BehaviorSubject, filter, finalize, Subject, takeUntil} from "rxjs";
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

@Component({
  selector: 'app-lang-settings',
  imports: [
    FormsModule,
    SettingsTabsComponent,
    FluentLanguageSelectorComponent,
    EditButtonComponent,
    AsyncPipe,
    TuiIcon,
    ConfirmModalComponent,
    PremiumBadgedContentComponent,
    RecentAuthGuardComponent,
    LanguageSetupComponent,
    TuiSwitch,
    TuiHintDirective,
  ],
  templateUrl: './lang-settings.component.html',
  styleUrl: './lang-settings.component.less'
})
export class LangSettingsComponent implements OnInit, OnDestroy {
  private languageService = inject(LanguageApiService);
  protected languageNameService = inject(LanguageNameService);
  private userInfoService = inject(UserInfoService);
  private alertService = inject(TuiNotificationService);
  private cdr = inject(ChangeDetectorRef);
  private languageApiService = inject(LanguageApiService);
  private targetLanguageDropdownService = inject(TargetLanguageDropdownService);
  private popupTemplateStateService = inject(PopupTemplateStateService);
  private route = inject(ActivatedRoute);
  private urlService = inject(UrlService);
  private recentAuthGuardService = inject(RecentAuthGuardService);
  private supportedLanguagesService = inject(SupportedLanguagesService);
  private utilsService = inject(UtilsService);

  private readonly destroy$ = new Subject<void>();
  @ViewChild(LanguageSetupComponent, {static: false}) languageSetupComponent!: LanguageSetupComponent;

  protected userInfo: UserInfo | null = null;
  protected languages: Language[] = [];

  // fluent languages
  protected selectedFluentLanguages: string[] = [];
  protected currentFluentLanguages: string[] = [];
  protected fluentEditable = false;
  protected fluentEnabled$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(true);
  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();

  // target languages
  protected targetLanguageNames: string[] = [];
  protected learners: Learner[] = [];
  protected addTargetLangModalVisible = false;
  protected targetLanguageSelectControl = new FormControl('', {nonNullable: true});
  protected colourPickerLanguage: LanguageCode | null = null;
  protected readonly cefrLevels = Object.values(CEFRLevel);
  protected readonly languageColours = [
    {name: 'Clay', hex: '#a66f5a'},
    {name: 'Ochre', hex: '#9a8146'},
    {name: 'Moss', hex: '#638565'},
    {name: 'Teal', hex: '#49858a'},
    {name: 'Slate', hex: '#657f9e'},
    {name: 'Indigo', hex: '#766ca0'},
    {name: 'Orchid', hex: '#94688f'},
    {name: 'Rose', hex: '#a56775'},
  ];
  private langColors: Record<string, string> = {};

  // TL deletion modal
  protected isConfirmTargetLangDeletionModalVisible = false;
  protected modalTitle = '';
  protected modalMessage = '';
  protected modalConfirmText = '';
  protected modalAction: (() => void) | null = null;

  ngOnInit(): void {
    this.popupTemplateStateService.drawerState$
      .pipe(
        takeUntil(this.destroy$),
        filter((state) => state.type === 'add-target-lang' && !state.visible)
      ).subscribe(() => {
      this.addTargetLangModalVisible = false;
      this.cdr.detectChanges();
    });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      if (params['target_lang'] === 'success') {
        this.alertService.open('Your target language has been successfully saved', {appearance: 'positive'}).subscribe();
        this.urlService.clearUrl();
      }

      if (params['intent'] === 'reauth') {
        this.recentAuthGuardService.updateStatusAndShowAlert();
        this.urlService.clearUrl();
      }
    });

    this.supportedLanguagesService.supportedLanguages$.pipe(takeUntil(this.destroy$)).subscribe((languages) => {
      if (languages) {
        this.languages = languages;
        this.populateFromUserInfo();
      }
    });

    this.targetLanguageDropdownService.langColors$
      .pipe(takeUntil(this.destroy$))
      .subscribe((colors) => {
        this.langColors = colors;
        this.syncLanguageColours();
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
        const fluentLanguageNames = this.languageNameService.mapLanguageCodesToNames(this.languages, info.fluentLangs);
        this.selectedFluentLanguages = fluentLanguageNames;
        this.currentFluentLanguages = fluentLanguageNames;
        this.targetLanguageNames = this.languageNameService.mapLanguageCodesToNames(this.languages, info.targetLangs);
        this.targetLanguageSelectControl.setValue(this.targetLanguageNames[0] ?? '');
        this.learners = info.learners;
        this.syncLanguageColours();
        this.updateFluentEnabled();
      }
    });
  }

  protected onCefrLevelChange(learner: Learner, newValue: CEFRLevel): void {
    const oldValue = learner.selfReportedLevel;
    learner.selfReportedLevel = newValue;

    this.languageApiService.updateLearner(learner.language, {level: newValue}).subscribe({
      next: () => {
        this.userInfoService.updateUserInfo({learners: this.learners});
      },
      error: (err) => {
        logger.error('Failed to update CEFR:', err);
        this.alertService.open('Failed to update CEFR level', {appearance: 'negative'}).subscribe();
        learner.selfReportedLevel = oldValue;
      },
    });
  }

  private validateFluentLanguages() {
    return this.selectedFluentLanguages.length <= this.userInfo!.subscription.getMaxFluentLanguages()
      && this.selectedFluentLanguages.length > 0;
  }

  private updateFluentEnabled(): void {
    const isEnabled =
      !this.fluentEditable ||
      (this.validateFluentLanguages() && !this.utilsService.areArraysEqual(this.selectedFluentLanguages, this.currentFluentLanguages, (a, b) => a === b));

    void Promise.resolve().then(() => {
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
      logger.error('This should not happen: form is invalid but submit was called');
      return;
    }

    this.loadingSubject$.next(true);

    const fluentLanguageCodes = this.languageNameService.mapLanguageNamesToCodes(this.languages, this.selectedFluentLanguages);
    this.languageService.saveFluentLanguages({
      langCodes: fluentLanguageCodes,
    }).pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: () => {
          this.alertService.open('Fluent languages saved', {appearance: 'positive'}).subscribe();
          this.fluentEditable = false;
          this.userInfoService.updateUserInfo({fluentLangs: fluentLanguageCodes});
        },
        error: (error) => {
          this.alertService.open(getErrorMessage(error, 'Failed to save fluent languages'), {appearance: 'negative'}).subscribe();
          this.restoreFluent();
        },
      });
  }

  private restoreFluent() {
    this.fluentEditable = false;
    this.selectedFluentLanguages = this.currentFluentLanguages;
  }


  // TARGET
  protected deleteTargetLang(learner: Learner) {
    this.restoreFluent();
    if (this.learners.length === 1) {
      logger.error("This should not happen: trying to delete the last target language");
      return;
    }
    this.targetLanguageSelectControl.setValue(this.getLanguageName(learner.language));
    this.recentAuthGuardService.guardAction(() => {
      this.prepareTargetLangDeletionModal();
    });
  }

  protected getCurrentTargetLanguageName(): string {
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
      logger.error(`Language code not found for ${deletedLanguageName}`);
      return;
    }

    this.languageApiService.deleteLearner(deletedLanguageCode).subscribe({
      next: () => {
        this.alertService
          .open(`Your ${deletedLanguageName} profile has been deleted`, {appearance: 'positive'})
          .subscribe();

        // Remove from UI list
        this.targetLanguageNames = this.targetLanguageNames.filter(lang => lang !== deletedLanguageName);

        // Reset selection to the first available language
        this.targetLanguageSelectControl.setValue(this.targetLanguageNames[0] ?? '');

        // Remove from service and update user info
        this.targetLanguageDropdownService.removeTargetLanguage(deletedLanguageCode);
        this.userInfoService.updateUserInfo({
          learners: this.userInfo?.learners.filter(learner => learner.language !== deletedLanguageCode)
        });
      },
      error: (error) => {
        this.alertService
          .open(getErrorMessage(error, 'Failed to delete your target language'), {appearance: 'negative'})
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

  protected activeToggleDisabled(learner: Learner): boolean {
    return learner.active && this.getActiveLearnersCount() === 1;
  }

  protected getActiveLearnersCount(): number {
    return this.learners.filter((learner) => learner.active).length;
  }

  protected onToggleActiveStatus(active: boolean, learner: Learner): void {
    if (!active && this.getActiveLearnersCount() === 1) {
      this.alertService.open('You must have at least one active target language', {appearance: 'negative'}).subscribe();
      return;
    }

    learner.active = active;

    this.languageApiService.updateLearner(learner.language, {active: active}).subscribe({
      next: () => {
        this.userInfoService.updateUserInfo({learners: this.learners});
        if (!active) {
          this.targetLanguageDropdownService.removeTargetLanguage(learner.language);
        } else {
          this.targetLanguageDropdownService.initializeLanguages(this.userInfo!);
        }
      },
      error: (err) => {
        this.alertService.open(getErrorMessage(err, 'Failed to update active status'), {appearance: 'negative'}).subscribe();
        learner.active = !active;
      },
    });
  }

  protected getLanguageName(languageCode: LanguageCode): string {
    return this.languageNameService.mapLanguageCodesToNames(this.languages, [languageCode])[0] ?? languageCode;
  }

  protected getLanguageColor(languageCode: LanguageCode, index: number): string {
    return this.langColors[languageCode] ?? this.languageColours[index % this.languageColours.length].hex;
  }

  protected toggleColourPicker(languageCode: LanguageCode): void {
    this.colourPickerLanguage = this.colourPickerLanguage === languageCode ? null : languageCode;
  }

  protected selectLanguageColour(languageCode: LanguageCode, colour: string): void {
    this.targetLanguageDropdownService.setLanguageColor(languageCode, colour);
    this.colourPickerLanguage = null;
  }

  private syncLanguageColours(): void {
    const allowedColours = new Set(this.languageColours.map((colour) => colour.hex));
    const normalizedColours = {...this.langColors};
    let changed = false;

    this.learners.forEach((learner, index) => {
      if (!allowedColours.has(normalizedColours[learner.language])) {
        normalizedColours[learner.language] = this.languageColours[index % this.languageColours.length].hex;
        changed = true;
      }
    });

    if (changed) {
      this.targetLanguageDropdownService.setLanguageColors(normalizedColours);
    }
  }

  protected getActiveToggleTooltip(learner: Learner): string {
    if (this.getActiveLearnersCount() === 1 && learner.active) {
      return 'You must have at least one active target language';
    }
    if (learner.active) {
      return 'Deactivating language removes it from the navbar dropdown';
    }
    return 'Activating language adds it to the navbar dropdown';
  }
}
