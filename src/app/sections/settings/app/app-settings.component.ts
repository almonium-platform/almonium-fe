import {Component, OnDestroy, OnInit} from "@angular/core";
import {ProfileSettingsService} from "../profile/profile-settings.service";
import {UserInfoService} from "../../../services/user-info.service";
import {Subject, take, takeUntil} from "rxjs";
import {DEFAULT_UI_PREFERENCES, UIPreferences} from "../../../models/userinfo.model";
import {SettingsTabsComponent} from "../tabs/settings-tabs.component";
import {NgForOf, TitleCasePipe} from "@angular/common";
import {TuiSwitch} from "@taiga-ui/kit";
import {FormsModule} from "@angular/forms";

@Component({
  selector: 'app-app-settings',
  templateUrl: './app-settings.component.html',
  styleUrls: ['./app-settings.component.less'],
  imports: [
    SettingsTabsComponent,
    NgForOf,
    TuiSwitch,
    FormsModule,
    TitleCasePipe
  ]
})
export class AppSettingsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  uiPreferences: UIPreferences = DEFAULT_UI_PREFERENCES;
  navbarColumns: [Array<keyof UIPreferences["navbar"]>, Array<keyof UIPreferences["navbar"]>] = [[], []];

  constructor(
    private profileSettingsService: ProfileSettingsService,
    private userInfoService: UserInfoService,
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
          console.log('Preferences saved successfully');
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
}
