import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { BranchFlowService } from '../../services/branch-flow.service';
import { TenantService } from '../../services/tenants.service';
import { ToastService } from '../toast/toast.service';
import { PosStore } from '../../store/pos-store.service';

@Component({
  selector: 'app-pos-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './pos-header.html',
  styleUrls: ['./pos-header.scss'],
})
export class PosHeader implements OnInit, OnDestroy {
  readonly #store = inject(PosStore);
  readonly #authService = inject(AuthService);
  readonly #tenantService = inject(TenantService);
  readonly #flow = inject(BranchFlowService);
  readonly #toast = inject(ToastService);
  readonly #router = inject(Router);

  readonly branch = this.#store.branch;
  readonly tenant = this.#store.tenant;
  readonly cashSession = this.#store.cashSession;
  readonly user = this.#authService.user;

  readonly menuOpen = signal(false);

  readonly now = signal(new Date());

  #timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.#timer = setInterval(() => {
      this.now.set(new Date());
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.#timer) {
      clearInterval(this.#timer);
    }
  }

  toggleMenu(): void {
    this.menuOpen.set(!this.menuOpen());
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  userNameLabel(): string {
    const user = this.user();

    if (!user) {
      return 'Usuario';
    }

    return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  }

  userInitials(): string {
    const user = this.user();

    if (!user) {
      return '?';
    }

    const initials = [user.firstName, user.lastName]
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase());

    return initials.join('') || user.email.charAt(0).toUpperCase();
  }

  goToBranchPicker(): void {
    this.closeMenu();
    void this.#router.navigate(['/branch-picker']);
  }

  exitContext(): void {
    this.closeMenu();

    if (this.user()?.role === 'sysadmin') {
      this.#store.clearContext();
      void this.#router.navigate(['/tenant-picker']);
      return;
    }

    this.#store.clearContext();

    this.#tenantService.listAll().subscribe({
      next: (tenants) => {
        const tenant = tenants[0];

        if (!tenant) {
          this.#toast.error('Tu cuenta no tiene un negocio asignado.');
          return;
        }

        this.#flow.selectTenant(tenant);
      },
      error: () => {
        this.#toast.error('No se pudo cargar tu negocio.');
      },
    });
  }

  logout(): void {
    this.closeMenu();

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

  timeLabel(): string {
    return this.now().toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  dateLabel(): string {
    return this.now().toLocaleDateString('es-CL', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  }

  goToCaja(): void {
    void this.#router.navigate(['/cash']);
  }
}