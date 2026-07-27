import {logger} from "../../shared/logger";
import {getErrorMessage} from '../../shared/http-error';
import {TuiNotificationService} from "@taiga-ui/core/components";
import { Injectable, inject } from '@angular/core';
import {AuthSettingsService} from "../../sections/settings/auth/auth-settings.service";
import {LocalStorageService} from "../../services/local-storage.service";
import {RecentAuthGuardStateService} from "../../shared/recent-auth-guard/recent-auth-guard-state.service";
import {AppHttpError} from "../../shared/app-http-error";

@Injectable({
  providedIn: 'root'
})
export class RecentAuthGuardService {
  private settingService = inject(AuthSettingsService);
  private alertService = inject(TuiNotificationService);
  private localStorageService = inject(LocalStorageService);
  private recentAuthGuardStateService = inject(RecentAuthGuardStateService);
  private pendingAction: (() => void) | null = null;

  private static readonly RECENT_LOGIN_CACHE_TIMESTAMP_KEY = 'recent_login_cache_timestamp';

  // universal live token auth guard
  public guardAction(onValidToken: () => void, forceReauthentication = false) {
    this.pendingAction = onValidToken;
    if (forceReauthentication) {
      this.localStorageService.removeItem(RecentAuthGuardService.RECENT_LOGIN_CACHE_TIMESTAMP_KEY);
      this.showIdentityVerificationPopup();
      return;
    }
    this.checkAuth(this.runPendingAction.bind(this), this.showIdentityVerificationPopup.bind(this));
  }

  public updateStatusAndShowAlert() {
    this.getRecentAuthStatus(() => {
      this.alertService.open('You successfully verified your identity!', {appearance: 'positive'}).subscribe();
      this.runPendingAction();
    });
  }

  public getRecentAuthStatus(onValidTokenAction?: () => void, identityVerification?: () => void): void {
    this.settingService.checkCurrentAccessTokenIsLive().subscribe({
      next: (expiresAt: string | null) => {
        if (expiresAt) {
          const expirationTime = new Date(expiresAt).getTime();
          this.localStorageService.saveItem(RecentAuthGuardService.RECENT_LOGIN_CACHE_TIMESTAMP_KEY, expirationTime);
          if (onValidTokenAction) {
            onValidTokenAction();
          }
        } else {
          this.localStorageService.removeItem(RecentAuthGuardService.RECENT_LOGIN_CACHE_TIMESTAMP_KEY);
          if (identityVerification) {
            identityVerification();
          }
        }
      },
      error: (error) => {
        if (error instanceof AppHttpError && error.status === 403 && identityVerification) {
          this.localStorageService.removeItem(RecentAuthGuardService.RECENT_LOGIN_CACHE_TIMESTAMP_KEY);
          identityVerification();
          return;
        }
        this.pendingAction = null;
        this.alertService.open(getErrorMessage(error, 'Failed to check access token'), {appearance: 'negative'}).subscribe();
        logger.error('Error checking access token:', error);
      }
    });
  }

  private getCachedResult(): boolean {
    const cacheTimestamp: number | null = this.localStorageService.getItem<number>(RecentAuthGuardService.RECENT_LOGIN_CACHE_TIMESTAMP_KEY);

    if (cacheTimestamp !== null && new Date().getTime() < cacheTimestamp) {
      return true;
    }
    this.localStorageService.removeItem(RecentAuthGuardService.RECENT_LOGIN_CACHE_TIMESTAMP_KEY);
    return false;
  }

  private showIdentityVerificationPopup() {
    this.alertService.open('To continue with this action, we need to verify your identity.', {appearance: 'info'}).subscribe();
    this.recentAuthGuardStateService.open();
  }

  private checkAuth(onValidTokenAction: () => void, identityVerification: () => void): void {
    const cachedResult: boolean = this.getCachedResult();
    if (!cachedResult) {
      this.getRecentAuthStatus(onValidTokenAction, identityVerification);
    } else {
      onValidTokenAction();
    }
  }

  private runPendingAction(): void {
    const action = this.pendingAction;
    this.pendingAction = null;
    action?.();
  }
}
