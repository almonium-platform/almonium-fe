import {inject} from '@angular/core';
import {lastValueFrom, of} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {UserInfoService} from "../services/user-info.service";

export async function initializeUser(): Promise<void> {
  const userInfoService = inject(UserInfoService);

  await lastValueFrom(
    userInfoService.fetchUserInfoFromServer().pipe(
      // Make sure init never blocks the app on error
      catchError(() => of(null))
    )
  );
}
