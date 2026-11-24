import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { canDo, homeRoute, PosAction } from '../services/roles';

/** Bloquea pantallas que el rol no puede usar y lo lleva a su pantalla de inicio. */
export function roleGuard(action: PosAction): CanActivateFn {
  return async () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const user = await authService.ensureUser();

    if (!user) {
      return router.createUrlTree(['/login']);
    }

    return canDo(user, action) ? true : router.createUrlTree([homeRoute(user)]);
  };
}
