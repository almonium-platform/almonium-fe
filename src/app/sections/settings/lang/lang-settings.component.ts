import {TuiInputModule, TuiInputNumberModule, TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {NavbarComponent} from "../../../shared/navbars/navbar/navbar.component";
import {SettingsTabsComponent} from "../tabs/settings-tabs.component";
import {
  FluentLanguageSelectorComponent
} from "../../../shared/fluent-language-selector/fluent-language-selector.component";
import {LanguageApiService} from "../../../services/language-api.service";
import {Language} from "../../../models/language.model";
import {UserInfoService} from "../../../services/user-info.service";
import {UserInfo} from "../../../models/userinfo.model";
import {EditButtonComponent} from "../../../shared/edit-button/edit-button.component";
import {LanguageNameService} from "../../../services/language-name.service";
import {TuiAlertService, TuiAutoColorPipe, TuiIcon, TuiScrollbar} from "@taiga-ui/core";
import {AsyncPipe, NgForOf, NgIf} from "@angular/common";
import {TuiChip, TuiSegmented} from "@taiga-ui/kit";
import {BehaviorSubject} from "rxjs";
import {LocalStorageService} from "../../../services/local-storage.service";
import {ConfirmModalComponent} from "../../../shared/modals/confirm-modal/confirm-modal.component";
import {TargetLanguageDropdownService} from "../../../services/target-language-dropdown.service";
import {LanguageCode} from "../../../models/language.enum";
import {ActivatedRoute, Router} from "@angular/router";
import {UrlService} from "../../../services/url.service";

@Component({
  selector: 'app-lang-settings',
  standalone: true,
  imports: [
    FormsModule,
    NavbarComponent,
    ReactiveFormsModule,
    TuiInputModule,
    TuiInputNumberModule,
    TuiTextfieldControllerModule,
    SettingsTabsComponent,
    FluentLanguageSelectorComponent,
    EditButtonComponent,
    NgIf,
    NgForOf,
    TuiChip,
    AsyncPipe,
    TuiSegmented,
    TuiIcon,
    ConfirmModalComponent,
    TuiAutoColorPipe,
    TuiScrollbar,
  ],
  templateUrl: './lang-settings.component.html',
  styleUrl: './lang-settings.component.less'
})
export class LangSettingsComponent implements OnInit {
  protected userInfo: UserInfo | null = null;
  protected languages: Language[] = [];

  // fluent languages
  protected selectedFluentLanguages: string[] = [];
  protected currentFluentLanguages: string[] = [];
  protected fluentEditable: boolean = false;
  protected fluentEnabled$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(true);

  // target languages
  protected currentTargetLanguages: string[] = [];
  protected selectedTargetedLanguageIndex: number = 0;

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
    private router: Router,
    private route: ActivatedRoute,
    private urlService: UrlService,
  ) {
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['target_lang'] === 'success') {
        this.alertService.open('Your target language has been successfully saved', {appearance: 'success'}).subscribe();
        this.urlService.clearUrl();
      }
    });

    this.languageService.getLanguages().subscribe((languages) => {
      this.languages = languages;
      this.populateFromUserInfo();
    });
  }

  private populateFromUserInfo() {
    this.userInfoService.userInfo$.subscribe((info) => {
      this.userInfo = info;
      if (info) {
        // fluent
        this.selectedFluentLanguages = this.userInfo!.fluentLangs;
        this.currentFluentLanguages = this.languageNameService.mapLanguageCodesToNames(this.languages, this.selectedFluentLanguages);
        this.updateFluentEnabled();

        // target
        this.currentTargetLanguages = this.languageNameService.mapLanguageCodesToNames(this.languages, this.userInfo!.targetLangs);
      }
    });
  }

  private validateFluentLanguages() {
    return this.selectedFluentLanguages.length <= 3 && this.selectedFluentLanguages.length > 0;
  }

  private updateFluentEnabled(): void {
    const isEnabled =
      !this.fluentEditable ||
      (this.validateFluentLanguages() && !this.areStringArraysEqual(this.selectedFluentLanguages, this.currentFluentLanguages));

    Promise.resolve().then(() => {
      this.fluentEnabled$.next(isEnabled);
      this.cdr.detectChanges();
    });
  }

  private areStringArraysEqual(array1: string[], array2: string[]): boolean {
    if (array1.length !== array2.length) {
      return false;
    }

    // Create sorted copies of both arrays to compare
    const sortedArray1 = [...array1].sort();
    const sortedArray2 = [...array2].sort();

    // Compare sorted arrays element by element
    return sortedArray1.every((value, index) => value === sortedArray2[index]);
  }

  protected onFluentLanguagesSelected(selectedLanguages: string[]): void {
    this.selectedFluentLanguages = selectedLanguages;
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

    const fluentLanguageCodes = this.languageNameService.mapLanguageNamesToCodes(this.languages, this.selectedFluentLanguages);
    this.languageService.saveFluentLanguages({
      langCodes: fluentLanguageCodes,
    }).subscribe({
      next: () => {
        this.alertService.open('Fluent languages saved successfully', {appearance: 'success'}).subscribe();
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

  protected deleteTargetLang() {
    this.restoreFluent();
    if (this.currentTargetLanguages.length === 1) {
      console.error("This should not happen: trying to delete the last target language");
      return;
    }
    this.prepareTargetLangDeletionModal();
  }

  private getCurrentTargetLanguage() {
    return this.currentTargetLanguages[this.selectedTargetedLanguageIndex];
  }

  private prepareTargetLangDeletionModal() {
    this.modalTitle = 'Delete ' + this.getCurrentTargetLanguage() + ' Profile';
    this.modalMessage = 'Are you sure? All your cards, progress, and settings will be lost.';
    this.modalConfirmText = 'Delete';
    this.modalAction = this.confirmTargetLangDeletion.bind(this);
    this.isConfirmTargetLangDeletionModalVisible = true;
  }

  protected closeTargetLangDeletionConfirmModal() {
    this.isConfirmTargetLangDeletionModalVisible = false;
  }

  protected confirmTargetLangDeletion() {
    const deletedLanguage = this.getSelectedTargetLangCode();
    this.languageApiService.deleteTargetLang(deletedLanguage).subscribe({
      next: () => {
        this.alertService
          .open(`Your ${this.getCurrentTargetLanguage()} profile has been deleted`, {appearance: 'success'})
          .subscribe();
        this.currentTargetLanguages.splice(this.selectedTargetedLanguageIndex, 1); // remove the deleted language
        this.selectedTargetedLanguageIndex = 0; // reset to the first language
        this.targetLanguageDropdownService.removeTargetLanguage(deletedLanguage);
      },
      error: (error) => {
        this.alertService
          .open(error.message || 'Failed to delete your target language', {appearance: 'error'})
          .subscribe();
      },
    });
  }

  private getSelectedTargetLangCode(): LanguageCode {
    return this.languageNameService.mapLanguageNameToCode(
      this.languages,
      this.getCurrentTargetLanguage())!;
  }

  protected navigateToLangSetup() {
    this.router.navigate(['/setup-languages'], {queryParams: {mode: 'add-target'}}).then(r => r);
  }
}
