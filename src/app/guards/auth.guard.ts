import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService, AuthUser } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  if (authService.user() === null) {
    try {
      const profile: AuthUser = await new Promise((resolve, reject) => {
        authService.me().subscribe({
          next: (user) => resolve(user),
          error: () => reject(new Error('profile-failed')),
        });
      });

      authService.setUser(profile);
    } catch {
      authService.setToken(null);
      return router.createUrlTree(['/login']);
    }
  }

  return true;
};