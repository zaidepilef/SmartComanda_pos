import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { BranchService } from '../../services/branches.service';
import { TenantService } from '../../services/tenants.service';
import { AuthService, authErrorMessage } from '../../services/auth.service';
import { PosStore } from '../../store/pos-store.service';
import { TurnstileComponent } from '../../components/turnstile/turnstile';

@Component({
  selector: 'app-login',
  imports: [FormsModule, TurnstileComponent],
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
})
export class LoginView {
  readonly #authService = inject(AuthService);
  readonly #tenantService = inject(TenantService);
  readonly #branchService = inject(BranchService);
  readonly #store = inject(PosStore);
  readonly #router = inject(Router);

  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal('');

  #turnstile!: TurnstileComponent;

  onTurnstileReady(component: TurnstileComponent): void {
    this.#turnstile = component;
  }

  submit(): void {
    if (this.loading()) {
      return;
    }

    const captchaToken = this.#turnstile?.token() ?? null;

    if (!captchaToken) {
      this.error.set('Completa la verificación de seguridad.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.#authService.login(this.email, this.password, captchaToken).subscribe({
      next: ({ token, user }) => {
        this.#authService.setToken(token);
        this.#authService.setUser(user);
        this.#afterLogin(user.role);
      },
      error: (err) => {
        this.loading.set(false);
        this.#turnstile?.reset();
        this.error.set(authErrorMessage(err.error?.error));
      },
    });
  }

  #afterLogin(role?: string): void {
    if (role === 'sysadmin') {
      void this.#router.navigate(['/tenant-picker']);
      return;
    }

    if (this.#store.branch()) {
      void this.#router.navigate(['/pos']);
      return;
    }

    this.#tenantService.listAll().subscribe({
      next: (tenants) => {
        const tenant = tenants[0];

        if (!tenant) {
          this.loading.set(false);
          this.error.set('Tu cuenta no tiene un tenant asignado.');
          return;
        }

        this.#store.setTenant(tenant);
        this.#selectBranchAutomatically();
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudo cargar tu negocio.');
      },
    });
  }

  #selectBranchAutomatically(): void {
    const tenantId = this.#store.tenant()?._id;

    if (!tenantId) {
      return;
    }

    this.#branchService.list(tenantId, 'true').subscribe({
      next: (branches) => {
        this.loading.set(false);

        if (branches.length === 1) {
          this.#store.setBranch(branches[0]);
          void this.#router.navigate(['/pos']);
          return;
        }

        if (branches.length === 0) {
          this.error.set('No hay sucursales activas para tu negocio.');
          return;
        }

        void this.#router.navigate(['/branch-picker']);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudieron cargar las sucursales.');
      },
    });
  }
}