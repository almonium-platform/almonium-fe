import {Injectable} from '@angular/core';
import {SettingService} from "./settings.service";
import {LocalStorageService} from "../../services/local-storage.service";
import {TuiAlertService} from "@taiga-ui/core";

@Injectable({
  providedIn: 'root'
})
export class RecentAuthGuardService {
  private static readonly TOKEN_CACHE_KEY = 'token_check_cache';
  private static readonly CACHE_TIMESTAMP_KEY = 'token_cache_timestamp';
  private static readonly CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes - should be in sync with BE (access token lifespan)

  constructor(
    private settingService: SettingService,
    private alertService: TuiAlertService,
    private localStorageService: LocalStorageService
  ) {
  }

  private isCacheValid(): boolean {
    const cacheTimestamp: number | null = this.localStorageService.getItem<number>(RecentAuthGuardService.CACHE_TIMESTAMP_KEY);
    if (cacheTimestamp !== null && new Date().getTime() - cacheTimestamp < RecentAuthGuardService.CACHE_DURATION_MS) {
      return true;
    }
    this.clearCache();
    return false;
  }

  cacheResult(isTokenLive: boolean): void {
    this.localStorageService.saveItem(RecentAuthGuardService.TOKEN_CACHE_KEY, isTokenLive);
    this.localStorageService.saveItem(RecentAuthGuardService.CACHE_TIMESTAMP_KEY, new Date().getTime());
  }

  getCachedResult(): boolean | null {
    if (this.isCacheValid()) {
      return this.localStorageService.getItem<boolean>(RecentAuthGuardService.TOKEN_CACHE_KEY);
    }
    this.clearCache();
    return null;
  }

  private clearCache(): void {
    this.localStorageService.removeItem(RecentAuthGuardService.TOKEN_CACHE_KEY);
    this.localStorageService.removeItem(RecentAuthGuardService.CACHE_TIMESTAMP_KEY);
  }

  checkAuth(onValidToken: () => void, identityVerification: () => void): void {
    const cachedResult = this.getCachedResult();
    console.log("CACHED RESULT IS: ", cachedResult);
    if (cachedResult !== null) {
      if (cachedResult) {
        onValidToken();
      } else {
        identityVerification();
      }
      return;
    }

    this.settingService.checkCurrentAccessTokenIsLive().subscribe({
      next: (isTokenLive: boolean) => {
        this.cacheResult(isTokenLive);
        if (isTokenLive) {
          onValidToken();
        } else {
          identityVerification();
        }
      },
      error: (error) => {
        this.alertService.open(error.message || 'Failed to check access token', {status: 'error'}).subscribe();
        console.error('Error checking access token:', error);
      }
    });
  }
}
