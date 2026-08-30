import {logger} from "../../../shared/logger";
import { Component, OnDestroy, OnInit, inject } from "@angular/core";
import {ProfileSettingsService} from "../profile/profile-settings.service";
import {UserInfoService} from "../../../services/user-info.service";
import {BehaviorSubject, finalize, forkJoin, of, Subject, take} from "rxjs";
import {DEFAULT_UI_PREFERENCES, UIPreferences} from "../../../models/userinfo.model";
import {SettingsTabsComponent} from "../tabs/settings-tabs.component";
import {TuiSwitch} from "@taiga-ui/kit/components";
import {FormsModule} from "@angular/forms";
import {TuiIcon, TuiNotificationService} from "@taiga-ui/core/components";
import {ButtonComponent} from "../../../shared/button/button.component";
import {LocalStorageService} from "../../../services/local-storage.service";
import {SupportedLanguagesService} from "../../../services/supported-langs.service";
import {TargetLanguageDropdownService} from "../../../services/target-language-dropdown.service";
import {catchError} from "rxjs/operators";
import {TUI_DARK_MODE} from '@taiga-ui/core/tokens';
import {ThemeService} from 'stream-chat-angular';
import {applyThemeAssets} from '../../../services/theme-assets';
import {applyMotionPreference, resolveReducedMotion} from '../../../services/motion-preference';

@Component({
  selector: 'app-app-settings',
  templateUrl: './app-settings.component.html',
  styleUrls: ['./app-settings.component.less'],
  imports: [
    SettingsTabsComponent,
    TuiSwitch,
    FormsModule,
    TuiIcon,
    ButtonComponent
  ]
})
export class AppSettingsComponent implements OnInit, OnDestroy {
  private static readonly APP_PREFERENCES_KEY = 'app_preferences';
  private profileSettingsService = inject(ProfileSettingsService);
  private userInfoService = inject(UserInfoService);
  private localStorageService = inject(LocalStorageService);
  private supportedLanguagesService = inject(SupportedLanguagesService);
  private targetLanguageDropdownService = inject(TargetLanguageDropdownService);
  private alertService = inject(TuiNotificationService);
  private taigaDarkMode = inject(TUI_DARK_MODE);
  private streamThemeService = inject(ThemeService);

  private readonly destroy$ = new Subject<void>();

  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();

  uiPreferences: UIPreferences = structuredClone(DEFAULT_UI_PREFERENCES);
  protected appearance: 'light' | 'dark' | 'system' = 'system';
  protected reduceMotion = false;
  protected dailyReview = false;
  protected dailyReviewTime = '19:00';
  protected weeklyEmail = false;
  protected readonly primaryNavItems: (keyof UIPreferences['navbar'])[] = ['discover', 'play', 'write'];
  protected readonly utilityNavItems: (keyof UIPreferences['navbar'])[] = ['social', 'timer', 'notifications'];

  ngOnInit(): void {
    const localPreferences = this.localStorageService.getItem<{
      appearance?: 'light' | 'dark' | 'system';
      reduceMotion?: boolean;
      dailyReview?: boolean;
      dailyReviewTime?: string;
      weeklyEmail?: boolean;
    }>(AppSettingsComponent.APP_PREFERENCES_KEY);
    this.appearance = localPreferences?.appearance ?? 'system';
    this.reduceMotion = resolveReducedMotion(
      localPreferences,
      window.matchMedia('(prefers-reduced-motion: reduce)'),
    );
    this.dailyReview = localPreferences?.dailyReview ?? false;
    this.dailyReviewTime = localPreferences?.dailyReviewTime ?? '19:00';
    this.weeklyEmail = localPreferences?.weeklyEmail ?? false;
    this.applyAppearancePreferences();

    this.userInfoService.userInfo$
      .pipe(take(1)) // Only listen to the first emission
      .subscribe((userInfo) => {
        if (userInfo) {
          this.uiPreferences = structuredClone(userInfo.uiPreferences);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected onPreferenceChange(
    key: keyof UIPreferences['navbar'],
    value: boolean
  ): void {
    const oldValue = this.uiPreferences.navbar[key];
    this.uiPreferences.navbar[key] = value;
    this.profileSettingsService.saveUiPreferences(this.uiPreferences)
      .subscribe({
        next: () => {
          this.userInfoService.updateUserInfo({uiPreferences: this.uiPreferences});
        },
        error: (error) => {
          logger.error('Failed to save preferences:', error);
          this.uiPreferences.navbar[key] = oldValue;
        },
      });
  }

  protected getKeys<T extends object>(obj: T): (keyof T)[] {
    return Object.keys(obj) as (keyof T)[];
  }

  protected get utilityNavEnabledCount(): number {
    return this.utilityNavItems.filter(item => this.uiPreferences.navbar[item]).length;
  }

  protected saveLocalPreferences(): void {
    this.localStorageService.saveItem(AppSettingsComponent.APP_PREFERENCES_KEY, {
      appearance: this.appearance,
      reduceMotion: this.reduceMotion,
      dailyReview: this.dailyReview,
      dailyReviewTime: this.dailyReviewTime,
      weeklyEmail: this.weeklyEmail,
    });
    this.applyAppearancePreferences();
  }

  private applyAppearancePreferences(): void {
    const root = document.documentElement;
    const isDark = this.appearance === 'dark' || (this.appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.dataset['theme'] = this.appearance;
    applyMotionPreference(root, this.reduceMotion);
    root.style.colorScheme = this.appearance === 'system' ? 'light dark' : this.appearance;
    this.taigaDarkMode.set(isDark);
    this.streamThemeService.theme$.next(isDark ? 'dark' : 'light');
    applyThemeAssets(isDark);
  }

  protected clearOfflineBooks() {
    this.loadingSubject$.next(true); // Show loading indicator

    this.localStorageService.clearReaderPositions();
    const cacheClear$ = typeof caches === 'undefined'
      ? Promise.resolve()
      : caches.keys().then(names => Promise.all(
        names.filter(name => /book|read|content/i.test(name)).map(name => caches.delete(name)),
      )).then(() => undefined);

    void cacheClear$.then(() => {
      this.loadingSubject$.next(false);
      this.alertService.open('Offline books cleared', {appearance: 'positive'}).subscribe();
    }).catch(error => {
      this.loadingSubject$.next(false);
      logger.error('Failed to clear offline books:', error);
      this.alertService.open('Failed to clear offline books', {appearance: 'negative'}).subscribe();
    });
  }

  protected reloadCachedAppData() {
    this.loadingSubject$.next(true);

    this.userInfoService.clearUserInfo();
    this.supportedLanguagesService.clearSupportedLanguages();
    this.targetLanguageDropdownService.clearTargetAndCurrentLanguages();

    // Create observables for fetching BOTH user info and supported languages
    const userInfoFetch$ = this.userInfoService.fetchUserInfoFromServer().pipe(
      catchError(err => {
        logger.error("Failed to fetch user info:", err);
        return of(null); // Return null on error to allow forkJoin to complete
      })
    );

    const supportedLangsFetch$ = this.supportedLanguagesService.getAllSupportedLanguages().pipe(
      catchError(err => {
        logger.error("Failed to fetch supported languages:", err);
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

            this.alertService.open('Data has been reloaded', {appearance: 'positive'}).subscribe();
          } else {
            // Handle cases where one or both fetches failed
            this.alertService.open('Failed to reload all data. Please refresh the page.', {appearance: 'negative'}).subscribe();
            logger.error("Data reload incomplete. UserInfo received:", !!userInfo, "SupportedLangs received:", !!supportedLangs);
          }
        },
        error: (error) => {
          // Handle errors from forkJoin itself (less likely with catchError on sources)
          logger.error('Critical failure during data reload:', error);
          this.alertService.open('Failed to reload data. Please refresh the page.', {appearance: 'negative'}).subscribe();
        },
      });
  }
}
