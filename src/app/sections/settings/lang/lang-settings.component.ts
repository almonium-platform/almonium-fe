import {logger} from "../../../shared/logger";
import {getErrorMessage} from '../../../shared/http-error';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import {FormControl, FormsModule} from "@angular/forms";
import {RouterLink} from '@angular/router';
import {SettingsTabsComponent} from "../tabs/settings-tabs.component";
import {
  FluentLanguageSelectorComponent
} from "../../../shared/fluent-language-selector/fluent-language-selector.component";
import {LanguageApiService} from "../../../services/language-api.service";
import {Language} from "../../../models/language.model";
import {UserInfoService} from "../../../services/user-info.service";
import {CEFRLevel, Learner, UserInfo} from "../../../models/userinfo.model";
import {LanguageNameService} from "../../../services/language-name.service";
import {TuiIcon, TuiLoader, TuiNotificationService} from "@taiga-ui/core/components";
import {TuiHintDirective} from "@taiga-ui/core/portals";
import {AsyncPipe, DatePipe, DecimalPipe} from "@angular/common";
import {TuiSwitch} from "@taiga-ui/kit/components";
import {BehaviorSubject, filter, finalize, of, Subject, switchMap, takeUntil} from "rxjs";
import {ConfirmModalComponent} from "../../../shared/modals/confirm-modal/confirm-modal.component";
import {TargetLanguageDropdownService} from "../../../services/target-language-dropdown.service";
import {LanguageCode} from "../../../models/language.enum";
import {ActiveLanguagePolicy, capped, switchAvailable} from "../../../models/active-language-policy.model";
import {ActivatedRoute} from "@angular/router";
import {UrlService} from "../../../services/url.service";
import {PaywallComponent} from "../../../shared/paywall/paywall.component";
import {RecentAuthGuardService} from "../../../authentication/auth/recent-auth-guard.service";
import {RecentAuthGuardComponent} from "../../../shared/recent-auth-guard/recent-auth-guard.component";
import {SupportedLanguagesService} from "../../../services/supported-langs.service";
import {LanguageSetupComponent} from "../../../onboarding/language-setup/language-setup.component";
import {PopupTemplateStateService} from "../../../shared/modals/popup-template/popup-template-state.service";
import {UtilsService} from "../../../services/utils.service";
import {LANGUAGE_COLOURS} from "../../../shared/language-colours";

@Component({
  selector: 'app-lang-settings',
  imports: [
    FormsModule,
    SettingsTabsComponent,
    FluentLanguageSelectorComponent,
    AsyncPipe,
    DatePipe,
    DecimalPipe,
    TuiIcon,
    TuiLoader,
    ConfirmModalComponent,
    PaywallComponent,
    RecentAuthGuardComponent,
    LanguageSetupComponent,
    TuiSwitch,
    TuiHintDirective,
    RouterLink,
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

  /** What the plan allows: how many languages stay active, and whether this month's switch is still available. */
  protected policy: ActiveLanguagePolicy | null = null;
  @ViewChild(LanguageSetupComponent, {static: false}) languageSetupComponent!: LanguageSetupComponent;
  @ViewChild(PaywallComponent, {static: true}) private paywallComponent!: PaywallComponent;
  /** Non-null while the paywall is a detour out of the add-language sheet, which offers the way back. */
  protected paywallBackLabel: string | null = null;

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
  protected readonly languageColours = LANGUAGE_COLOURS;
  protected readonly updatingLearnerIds = new Set<string>();
  private langColors: Record<string, string> = {};

  // TL deletion modal
  protected isConfirmTargetLangDeletionModalVisible = false;
  protected modalTitle = '';
  protected modalMessage = '';
  protected modalConfirmText = '';
  protected modalAction: (() => void) | null = null;

  ngOnInit(): void {
    this.loadPolicy();

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
    if (learner.selfReportedLevel === newValue || this.updatingLearnerIds.has(learner.id)) {
      return;
    }

    const previousLearners = this.learners;
    const optimisticLearner = new Learner(learner.id, learner.language, newValue, learner.active);
    this.learners = this.learners.map((currentLearner) =>
      currentLearner.id === learner.id ? optimisticLearner : currentLearner,
    );
    this.updatingLearnerIds.add(learner.id);

    this.languageApiService.updateLearner(learner.language, {level: newValue}).pipe(
      finalize(() => this.updatingLearnerIds.delete(learner.id)),
    ).subscribe({
      next: (savedLearner) => {
        const persistedLearner = savedLearner ?? optimisticLearner;
        this.learners = this.learners.map((currentLearner) =>
          currentLearner.id === learner.id ? persistedLearner : currentLearner,
        );
        this.userInfoService.updateUserInfo({learners: this.learners});
      },
      error: (err) => {
        logger.error('Failed to update CEFR:', err);
        this.alertService.open('Failed to update CEFR level', {appearance: 'negative'}).subscribe();
        this.learners = previousLearners;
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

  protected openPaywall() {
    this.paywallBackLabel = null;
    this.popupTemplateStateService.open(this.paywallComponent.content, 'paywall');
  }

  // The upsell is a detour, not a destination: the reader still means to add a language, so the
  // plans replace the sheet's content in place rather than routing the page underneath it.
  protected openPaywallFromLangSetup() {
    this.paywallBackLabel = 'Back to languages';
    this.popupTemplateStateService.open(this.paywallComponent.content, 'paywall');
  }

  protected returnToLangSetupPopup() {
    this.paywallBackLabel = null;
    // The sheet's component stays mounted while the paywall shows, so its form keeps what was typed.
    this.popupTemplateStateService.open(this.languageSetupComponent.content, 'add-target-lang', false, true);
  }

  protected openLangSetupPopup() {
    this.addTargetLangModalVisible = true;
    setTimeout(() => {
      // Taiga renders the language picker in a document-level portal, which the
      // popup's click-outside directive would otherwise treat as a dismissal.
      this.popupTemplateStateService.open(this.languageSetupComponent.content, 'add-target-lang', false, true);
    }, 50);
  }

  /** At the allowance the row is a choice, not a switch: turning one on turns another off. */
  protected get atAllowance(): boolean {
    return capped(this.policy) && this.getActiveLearnersCount() >= this.policy!.allowance;
  }

  protected get allowance(): number | null {
    return capped(this.policy) ? this.policy!.allowance : null;
  }

  /** How many languages the account may hold at all. The same on every plan, so reaching it is not an upsell. */
  protected get languageCeiling(): number {
    return this.userInfo?.subscription.getMaxTargetLanguages() ?? 0;
  }

  protected get atLanguageCeiling(): boolean {
    return this.userInfo?.isAtLanguageCeiling() ?? false;
  }

  /**
   * What adding one more would actually do. The account can hold it either way; at the allowance it arrives set
   * aside, and saying so beforehand is the difference between a limit and a surprise.
   */
  protected get allowanceNote(): string {
    const allowance = this.allowance;
    const held = allowance === 1 ? 'one active language' : `${allowance} active languages`;
    return `Your plan keeps ${held}. Another one is saved with everything in it, `
      + 'but waits until you make it active or upgrade.';
  }

  /** Words kept in a language, so a read-only row says what it is holding rather than just that it is off. */
  protected wordsKept(learner: Learner): number | null {
    return this.policy?.languages.find(choice => choice.language === learner.language)?.wordsKept ?? null;
  }

  protected get switchAvailable(): boolean {
    return switchAvailable(this.policy);
  }

  protected get nextSwitchOn(): Date | null {
    return this.policy?.nextSwitchAllowedAt ?? null;
  }

  /**
   * One visible line per row for whatever is greying that row's control: the last active language cannot be
   * switched off, and past the allowance "Make active" waits out the cooldown. Hover text says neither on touch.
   */
  protected learnerLockNote(learner: Learner): string | null {
    if (learner.active && this.getActiveLearnersCount() === 1) {
      return this.learners.length === 1
        ? 'This is your only language. Add another before you can turn it off.'
        : 'This is your only active language. Make another one active to turn it off.';
    }
    if (!learner.active && this.atAllowance && !this.switchAvailable) {
      return this.switchWaitNote;
    }
    return null;
  }

  /**
   * "Make active" greys for the rest of the cooldown. Naming the day it lifts is the whole explanation; without it
   * the row shows the exit and hides the lock.
   */
  protected get switchWaitNote(): string {
    const next = this.nextSwitchOn;
    const used = 'This month\'s language switch is used.';
    return next
      ? `${used} You can change again on ${new Intl.DateTimeFormat(undefined, {day: 'numeric', month: 'long'}).format(next)}.`
      : used;
  }

  /**
   * At the allowance the toggle is display-only: turning one language on has to turn another off, and that swap is
   * one atomic call made through "Make active" so the account can never sit at zero active languages.
   */
  protected activeToggleDisabled(learner: Learner): boolean {
    if (learner.active) {
      return this.getActiveLearnersCount() === 1;
    }
    return this.atAllowance;
  }

  protected makeActiveDisabled(learner: Learner): boolean {
    return this.updatingLearnerIds.has(learner.id) || !this.switchAvailable;
  }

  protected makeActive(learner: Learner): void {
    if (this.makeActiveDisabled(learner)) {
      return;
    }
    this.onToggleActiveStatus(true, learner);
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
    this.updatingLearnerIds.add(learner.id);

    this.languageApiService.updateLearner(learner.language, {active: active}).pipe(
      // Taking a language up at the allowance sets another one aside on the server, and only the server knows which:
      // it picks by reading history. Re-read the account instead of guessing, so the list never shows two active.
      switchMap(() => active ? this.userInfoService.fetchUserInfoFromServer() : of(null)),
      finalize(() => this.updatingLearnerIds.delete(learner.id)),
    ).subscribe({
      next: (refreshed) => {
        this.loadPolicy();
        if (!refreshed) {
          // Setting aside touches one row, and a failed re-read still leaves the local flip as the best picture.
          this.userInfoService.updateUserInfo({learners: this.learners});
        }
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
    const allowedColours = new Set<string>(this.languageColours.map((colour) => colour.hex));
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
    if (!learner.active && this.atAllowance) {
      return 'Use Make active to change which language is active';
    }
    if (learner.active) {
      return 'Deactivating language removes it from the navbar dropdown';
    }
    return 'Activating language adds it to the navbar dropdown';
  }

  private loadPolicy(): void {
    this.languageApiService.getActiveLanguagePolicy()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: policy => this.policy = policy,
        error: error => logger.error('Could not load your language allowance', error),
      });
  }
}
