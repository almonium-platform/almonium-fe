import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {LocalStorageService} from '../../../services/local-storage.service'; // Replace with actual service path

// Unauth guard to protect routes that should not be accessible to authenticated users
export const unauthGuard: CanActivateFn = (route, state) => {
  const localStorageService = inject(LocalStorageService);
  const router = inject(Router);

  if (localStorageService.getUserInfo()) {
    return router.createUrlTree(['/home']);
  }

  return true;
};
