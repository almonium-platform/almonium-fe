import {logger} from "../../../shared/logger";
import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {UserInfoService} from "../../../services/user-info.service";
import {firstValueFrom} from "rxjs";

// Admin guard to protect ops routes; the real boundary is server-side (/ops/** requires ROLE_ADMIN),
// this only avoids showing the page to non-admins.
export const adminGuard: CanActivateFn = async () => {
  const userService = inject(UserInfoService);
  const router = inject(Router);

  try {
    const userInfo = await firstValueFrom(userService.loadUserInfo());

    if (!userInfo?.admin) {
      return router.createUrlTree(['/home']);
    }

    return true;
  } catch (error) {
    logger.error('Error loading user info in adminGuard:', error);
    return router.createUrlTree(['/home']);
  }
};
