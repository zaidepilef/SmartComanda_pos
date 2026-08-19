import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { ToastService } from '../components/toast/toast.service';
import { BranchService } from '../services/branches.service';
import { Tenant } from '../services/tenants.service';
import { PosStore } from '../store/pos-store.service';

@Injectable({ providedIn: 'root' })
export class BranchFlowService {
  readonly #branchService = inject(BranchService);
  readonly #store = inject(PosStore);
  readonly #toast = inject(ToastService);
  readonly #router = inject(Router);

  selectTenant(tenant: Tenant): void {
    this.#store.setTenant(tenant);

    this.#branchService.list(tenant._id, 'true').subscribe({
      next: (branches) => {
        if (branches.length === 1) {
          this.#store.setBranch(branches[0]);
          void this.#router.navigate(['/pos']);
          return;
        }

        if (branches.length === 0) {
          this.#toast.error('Este negocio no tiene sucursales activas.');
          return;
        }

        void this.#router.navigate(['/branch-picker']);
      },
      error: () => {
        this.#toast.error('No se pudieron cargar las sucursales.');
      },
    });
  }

  selectBranch(branchId: string): void {
    this.#branchService.list(this.#store.tenant()?._id, 'true').subscribe({
      next: (branches) => {
        const branch = branches.find((item) => item._id === branchId);

        if (!branch) {
          this.#toast.error('Sucursal no encontrada.');
          return;
        }

        this.#store.setBranch(branch);
        void this.#router.navigate(['/pos']);
      },
      error: () => {
        this.#toast.error('No se pudieron cargar las sucursales.');
      },
    });
  }
}