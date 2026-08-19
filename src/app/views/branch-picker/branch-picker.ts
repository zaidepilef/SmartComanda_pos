import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { BranchFlowService } from '../../services/branch-flow.service';
import { AuthService } from '../../services/auth.service';
import { Branch, BranchService } from '../../services/branches.service';
import { PosStore } from '../../store/pos-store.service';

@Component({
  selector: 'app-branch-picker',
  imports: [],
  templateUrl: './branch-picker.html',
  styleUrls: ['./branch-picker.scss'],
})
export class BranchPicker {
  readonly #branchService = inject(BranchService);
  readonly #flow = inject(BranchFlowService);
  readonly #store = inject(PosStore);
  readonly #authService = inject(AuthService);
  readonly #router = inject(Router);

  readonly tenant = this.#store.tenant;

  readonly branches = signal<Branch[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    const tenantId = this.#store.tenant()?._id;

    if (!tenantId) {
      void this.#router.navigate(['/tenant-picker']);
      return;
    }

    this.#branchService.list(tenantId, 'true').subscribe({
      next: (branches) => {
        this.branches.set(branches);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudieron cargar las sucursales.');
      },
    });
  }

  choose(branchId: string): void {
    this.#flow.selectBranch(branchId);
  }

  back(): void {
    this.#store.setTenant(null);
    void this.#router.navigate(['/tenant-picker']);
  }

  logout(): void {
    this.#authService.logout().subscribe({
      complete: () => {
        this.#authService.setToken(null);
        this.#store.clearContext();
        void this.#router.navigate(['/login']);
      },
      error: () => {
        this.#authService.setToken(null);
        this.#store.clearContext();
        void this.#router.navigate(['/login']);
      },
    });
  }
}