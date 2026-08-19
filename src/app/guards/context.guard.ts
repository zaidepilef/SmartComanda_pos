import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { PosStore } from '../store/pos-store.service';

export const contextGuard: CanActivateFn = () => {
  const store = inject(PosStore);
  const router = inject(Router);

  const tenant = store.tenant();

  if (!tenant) {
    return router.createUrlTree(['/tenant-picker']);
  }

  const branch = store.branch();

  if (!branch) {
    return router.createUrlTree(['/branch-picker']);
  }

  return true;
};