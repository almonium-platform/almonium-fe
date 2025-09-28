import {inject, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';
import {lastValueFrom, of} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {UserInfoService} from "../services/user-info.service";

export async function initializeUser(): Promise<void> {
  const platformId = inject(PLATFORM_ID);
  const userInfoService = inject(UserInfoService);

  // Only check cookies in the browser
  const hasSessionCookie =
    isPlatformBrowser(platformId) &&
    typeof document !== 'undefined' &&
    document.cookie.includes('accessToken=');

  if (!hasSessionCookie) return;

  await lastValueFrom(
    userInfoService.fetchUserInfoFromServer().pipe(
      // Make sure init never blocks the app on error
      catchError(() => of(null))
    )
  );
}
