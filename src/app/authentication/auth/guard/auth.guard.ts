import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {UserInfoService} from "../../../services/user-info.service";
import {firstValueFrom} from "rxjs";
import {SetupStep, UserInfo} from "../../../models/userinfo.model";

// Auth guard to protect routes that require authentication
export const authGuard: CanActivateFn = async (route, state) => {
  const userService = inject(UserInfoService);
  const router = inject(Router);

  try {
    const userInfo: UserInfo | null = await firstValueFrom(userService.loadUserInfo());

    if (!userInfo) {
      return router.createUrlTree(['/auth']);
    }

    if (userInfo.setupStep !== SetupStep.COMPLETED && state.url !== '/onboarding') {
      return router.createUrlTree(['/onboarding']);
    }

    return true;
  } catch (error) {
    console.error('Error loading user info in authGuard:', error);
    return router.createUrlTree(['/auth'])
  }
};
