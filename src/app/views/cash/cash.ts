import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ToastService } from '../../components/toast/toast.service';
import {
  CashSession,
  CashSessionService,
  ClosingAmounts,
} from '../../services/cash-sessions.service';
import { PAYMENT_METHOD_LABELS, PaymentMethod } from '../../services/branches.service';
import { PosStore } from '../../store/pos-store.service';

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'debit', 'credit', 'transfer'];

const formatCLP = (value: number): string =>
  `$${Math.round(value).toLocaleString('es-CL')}`;

const formatSignedCLP = (value: number): string =>
  `${value < 0 ? '−' : '+'}${formatCLP(Math.abs(value))}`;

@Component({
  selector: 'app-cash',
  imports: [FormsModule],
  templateUrl: './cash.html',
  styleUrls: ['./cash.scss'],
})
export class CashView {
  readonly #cashSessionService = inject(CashSessionService);
  readonly #store = inject(PosStore);
  readonly #toast = inject(ToastService);
  readonly #router = inject(Router);

  readonly cashSession = this.#store.cashSession;

  openingAmount: number | null = null;
  readonly opening = signal(false);
  readonly error = signal('');
  readonly closing = signal(false);
  readonly closingFormOpen = signal(false);
  closingAmounts: ClosingAmounts = {};
  closedSession: CashSession | null = null;

  constructor() {
    const branchId = this.#store.branch()?._id;

    if (!branchId) {
      void this.#router.navigate(['/branch-picker']);
      return;
    }

    if (this.#store.cashSession() === null) {
      this.#cashSessionService.current(branchId).subscribe({
        next: (session) => this.#store.setCashSession(session),
        error: (err) => {
          if (err.status !== 404) {
            this.error.set('No se pudo consultar la caja.');
          }
        },
      });
    }
  }

  openSession(): void {
    const branchId = this.#store.branch()?._id;

    if (!branchId || this.opening()) {
      return;
    }

    const amount = this.openingAmount ?? 0;

    if (amount < 0) {
      this.error.set('El monto inicial no puede ser negativo.');
      return;
    }

    this.opening.set(true);
    this.error.set('');

    this.#cashSessionService.open({ branchId, openingAmount: amount }).subscribe({
      next: (session) => {
        this.opening.set(false);
        this.#store.setCashSession(session);
        this.#toast.ok('Caja abierta correctamente.');
      },
      error: (err) => {
        this.opening.set(false);
        this.error.set(err.error?.error ?? 'No se pudo abrir la caja.');
      },
    });
  }

  totalSession(): number {
    const session = this.cashSession();

    if (!session) {
      return 0;
    }

    const totals = session.totals ?? {
      cash: 0,
      debit: 0,
      credit: 0,
      transfer: 0,
    };

    return (
      totals.cash +
      totals.debit +
      totals.credit +
      totals.transfer +
      session.openingAmount
    );
  }

  paymentTotal(method: PaymentMethod): number {
    const session = this.cashSession();

    return session?.totals?.[method] ?? 0;
  }

  paymentLabel(method: PaymentMethod): string {
    return PAYMENT_METHOD_LABELS[method] ?? method;
  }

  branchName(): string {
    return this.#store.branch()?.name ?? 'la sucursal';
  }

  openedAtLabel(session: CashSession): string {
    return new Date(session.openedAt).toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  paymentMethods(): PaymentMethod[] {
    const session = this.cashSession();

    return session ? (Object.keys(session.totals) as PaymentMethod[]) : [];
  }

  startClose(): void {
    const session = this.cashSession();

    if (!session || this.closing()) {
      return;
    }

    const totals = session.totals ?? {
      cash: 0,
      debit: 0,
      credit: 0,
      transfer: 0,
    };

    this.closingAmounts = { ...totals };
    this.closingFormOpen.set(true);
    this.error.set('');
  }

  cancelClose(): void {
    if (this.closing()) {
      return;
    }

    this.closingFormOpen.set(false);
    this.closingAmounts = {};
  }

  closeSession(): void {
    const session = this.cashSession();

    if (!session || this.closing()) {
      return;
    }

    for (const method of PAYMENT_METHODS) {
      const amount = this.closingAmounts[method] ?? 0;

      if (amount < 0 || Number.isNaN(amount)) {
        this.error.set(`El monto de ${this.paymentLabel(method)} no puede ser negativo.`);
        return;
      }
    }

    this.closing.set(true);
    this.error.set('');

    this.#cashSessionService.close(session._id, { closingAmounts: this.closingAmounts }).subscribe({
      next: (closed) => {
        this.closing.set(false);
        this.closingFormOpen.set(false);
        this.closedSession = closed;
        this.#store.setCashSession(null);
        this.#toast.ok('Caja cerrada correctamente.');
      },
      error: (err) => {
        this.closing.set(false);
        this.error.set(err.error?.error ?? 'No se pudo cerrar la caja.');
      },
    });
  }

  closingDifference(method: PaymentMethod): number {
    const closed = this.closedSession;

    if (!closed) {
      return 0;
    }

    return closed.difference?.[method] ?? 0;
  }

  formatSignedCLP(value: number): string {
    return formatSignedCLP(value);
  }

  formatCLP(value: number): string {
    return formatCLP(value);
  }

  goToPos(): void {
    void this.#router.navigate(['/pos']);
  }

  finishClosed(): void {
    this.closedSession = null;
    void this.#router.navigate(['/tenant-picker']);
  }

  logout(): void {
    this.#router.navigate(['/tenant-picker']);
  }
}