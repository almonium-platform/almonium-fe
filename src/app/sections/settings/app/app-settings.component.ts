import {Component, OnDestroy, OnInit} from "@angular/core";
import {ProfileSettingsService} from "../profile/profile-settings.service";
import {UserInfoService} from "../../../services/user-info.service";
import {BehaviorSubject, finalize, Subject, take} from "rxjs";
import {DEFAULT_UI_PREFERENCES, UIPreferences} from "../../../models/userinfo.model";
import {SettingsTabsComponent} from "../tabs/settings-tabs.component";
import {TitleCasePipe} from "@angular/common";
import {TuiSwitch} from "@taiga-ui/kit";
import {FormsModule} from "@angular/forms";
import {TuiAlertService, TuiIcon} from "@taiga-ui/core";
import {ButtonComponent} from "../../../shared/button/button.component";
import {LocalStorageService} from "../../../services/local-storage.service";
import {SupportedLanguagesService} from "../../../services/supported-langs.service";
import {TargetLanguageDropdownService} from "../../../services/target-language-dropdown.service";

@Component({
  selector: 'app-app-settings',
  templateUrl: './app-settings.component.html',
  styleUrls: ['./app-settings.component.less'],
  imports: [
    SettingsTabsComponent,
    TuiSwitch,
    FormsModule,
    TitleCasePipe,
    TuiIcon,
    ButtonComponent
  ]
})
export class AppSettingsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();

  uiPreferences: UIPreferences = DEFAULT_UI_PREFERENCES;
  navbarColumns: [Array<keyof UIPreferences["navbar"]>, Array<keyof UIPreferences["navbar"]>] = [[], []];

  constructor(
    private profileSettingsService: ProfileSettingsService,
    private userInfoService: UserInfoService,
    private localStorageService: LocalStorageService,
    private supportedLanguagesService: SupportedLanguagesService,
    private targetLanguageDropdownService: TargetLanguageDropdownService,
    private alertService: TuiAlertService,
  ) {
  }

  ngOnInit(): void {
    this.userInfoService.userInfo$
      .pipe(take(1)) // Only listen to the first emission
      .subscribe((userInfo) => {
        if (userInfo) {
          this.uiPreferences = {...userInfo.uiPreferences};
          this.computeColumns();
        }
      });
  }

  private computeColumns(): void {
    const navbarKeys = this.getKeys(this.uiPreferences.navbar);
    this.navbarColumns = this.splitIntoColumns(navbarKeys);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  splitIntoColumns<T>(items: T[]): [T[], T[]] {
    const middleIndex = Math.ceil(items.length / 2);
    return [items.slice(0, middleIndex), items.slice(middleIndex)];
  }

  protected onPreferenceChange<K extends keyof UIPreferences>(
    category: K,
    key: keyof UIPreferences[K], // Ensure `key` matches the keys of the category
    value: boolean
  ): void {
    // @ts-ignores
    const oldValue = this.uiPreferences[category][key]; // @ts-ignore
    this.uiPreferences[category][key] = value;
    this.profileSettingsService.saveUiPreferences(this.uiPreferences)
      .subscribe({
        next: () => {
          this.userInfoService.updateUserInfo({uiPreferences: this.uiPreferences});
        },
        error: (error) => {
          console.error('Failed to save preferences:', error);
          this.uiPreferences[category][key] = oldValue;
        },
      });
  }

  protected getKeys<T extends object>(obj: T): (keyof T)[] {
    return Object.keys(obj) as (keyof T)[];
  }

  protected clearLocalStorage() {
    this.loadingSubject$.next(true);

    this.userInfoService.clearUserInfo();
    this.supportedLanguagesService.clearSupportedLanguages();
    this.targetLanguageDropdownService.clearTargetAndCurrentLanguages();
    this.localStorageService.clearAllData();

    this.userInfoService.fetchUserInfoFromServer()
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: (userInfo) => {
          if (!userInfo) return;

          this.uiPreferences = {...userInfo.uiPreferences};
          this.targetLanguageDropdownService.loadLangColors();
          this.targetLanguageDropdownService.initializeLanguages(userInfo);
          this.alertService.open('Data has been reloaded', {appearance: 'success'}).subscribe();
        },
        error: (error) => {
          console.error('Failed to update user info:', error);
        },
      })
  }
}
