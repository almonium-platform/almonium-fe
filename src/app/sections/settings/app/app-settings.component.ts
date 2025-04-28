import {Component, OnDestroy, OnInit} from "@angular/core";
import {ProfileSettingsService} from "../profile/profile-settings.service";
import {UserInfoService} from "../../../services/user-info.service";
import {BehaviorSubject, finalize, forkJoin, of, Subject, take} from "rxjs";
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
import {catchError} from "rxjs/operators";

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
    this.loadingSubject$.next(true); // Show loading indicator

    // Clear everything first
    this.userInfoService.clearUserInfo();
    this.supportedLanguagesService.clearSupportedLanguages();
    this.targetLanguageDropdownService.clearTargetAndCurrentLanguages();
    this.localStorageService.clearAllData();

    // Create observables for fetching BOTH user info and supported languages
    const userInfoFetch$ = this.userInfoService.fetchUserInfoFromServer().pipe(
      catchError(err => {
        console.error("Failed to fetch user info:", err);
        return of(null); // Return null on error to allow forkJoin to complete
      })
    );

    const supportedLangsFetch$ = this.supportedLanguagesService.getAllSupportedLanguages().pipe(
      catchError(err => {
        console.error("Failed to fetch supported languages:", err);
        return of(null); // Return null on error
      })
    );

    forkJoin([
      userInfoFetch$,
      supportedLangsFetch$
    ])
      .pipe(
        finalize(() => this.loadingSubject$.next(false)) // Hide loading indicator
      )
      .subscribe({
        // Destructure the results array in the order they were passed to forkJoin
        next: ([userInfo, supportedLangs]) => { // <-- Destructure array result
          // Check if BOTH fetches were successful (not null)
          if (userInfo && supportedLangs) {
            // Both succeeded, UserInfoService & SupportedLanguagesService have updated.
            // Re-initialize dependent services
            this.targetLanguageDropdownService.loadLangColors();
            this.targetLanguageDropdownService.initializeLanguages(userInfo); // Pass the fetched userInfo

            // Update local state if needed (e.g., this.uiPreferences)
            this.uiPreferences = {...userInfo.uiPreferences};

            this.alertService.open('Data has been reloaded', {appearance: 'success'}).subscribe();
          } else {
            // Handle cases where one or both fetches failed
            this.alertService.open('Failed to reload all data. Please refresh the page.', {appearance: 'error'}).subscribe();
            console.error("Data reload incomplete. UserInfo received:", !!userInfo, "SupportedLangs received:", !!supportedLangs);
          }
        },
        error: (error) => {
          // Handle errors from forkJoin itself (less likely with catchError on sources)
          console.error('Critical failure during data reload:', error);
          this.alertService.open('Failed to reload data. Please refresh the page.', {appearance: 'error'}).subscribe();
        },
      });
  }
}
