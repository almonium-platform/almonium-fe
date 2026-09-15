import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {UserInfoService} from '../../../services/user-info.service';

// Unauth guard to protect routes that should not be accessible to authenticated users
export const unauthGuard: CanActivateFn = async () => {
  const userInfoService = inject(UserInfoService);
  const router = inject(Router);

  const userInfo = await firstValueFrom(userInfoService.loadUserInfo());
  if (userInfo) {
    return router.createUrlTree(['/home']);
  }

  return true;
};
