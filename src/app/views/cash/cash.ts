import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ToastService } from '../../components/toast/toast.service';
import {
  CashClosureLine,
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
  Math.round(value) === 0 ? formatCLP(0) : `${value < 0 ? '−' : '+'}${formatCLP(Math.abs(value))}`;

const startOfToday = (): number => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
};

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
  readonly loading = signal(true);
  readonly opening = signal(false);
  readonly error = signal('');
  readonly closing = signal(false);
  readonly closingFormOpen = signal(false);
  readonly closedSession = signal<CashSession | null>(null);
  closingAmounts: ClosingAmounts = {};
  closingNote = '';

  constructor() {
    if (!this.#store.branch()?._id) {
      void this.#router.navigate(['/branch-picker']);
      return;
    }

    // Siempre se consulta la API: la caja guardada en el navegador puede estar desactualizada.
    this.#loadCurrent();
  }

  #loadCurrent(): void {
    const branchId = this.#store.branch()?._id;

    if (!branchId) {
      return;
    }

    this.loading.set(true);

    this.#cashSessionService.current(branchId).subscribe({
      next: (session) => {
        this.#store.setCashSession(session);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error ?? 'No se pudo consultar la caja.');
      },
    });
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

        if (err.status === 409) {
          // Ya había una caja abierta (quizá desde otro equipo): se muestra para cerrarla.
          this.#toast.error('Ya hay una caja abierta en esta sucursal.');
          this.#loadCurrent();
          return;
        }

        this.error.set(err.error?.error ?? 'No se pudo abrir la caja.');
      },
    });
  }

  paymentMethods(): PaymentMethod[] {
    const session = this.cashSession();
    const branchMethods = this.#store.branch()?.paymentMethods ?? PAYMENT_METHODS;

    return PAYMENT_METHODS.filter(
      (method) => branchMethods.includes(method) || (session?.totals?.[method] ?? 0) !== 0
    );
  }

  paymentTotal(method: PaymentMethod): number {
    return this.cashSession()?.totals?.[method] ?? 0;
  }

  expected(method: PaymentMethod): number {
    return this.cashSession()?.expected?.[method] ?? this.paymentTotal(method);
  }

  salesTotal(): number {
    return PAYMENT_METHODS.reduce((sum, method) => sum + this.paymentTotal(method), 0);
  }

  paymentLabel(method: PaymentMethod): string {
    return PAYMENT_METHOD_LABELS[method] ?? method;
  }

  branchName(): string {
    return this.#store.branch()?.name ?? 'la sucursal';
  }

  dateTimeLabel(value: string | null): string {
    if (!value) {
      return '';
    }

    return new Date(value).toLocaleString('es-CL', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** La caja se abrió antes de hoy y quedó sin cerrar. */
  isStale(session: CashSession): boolean {
    return new Date(session.openedAt).getTime() < startOfToday();
  }

  startClose(): void {
    if (!this.cashSession() || this.closing()) {
      return;
    }

    this.closingAmounts = Object.fromEntries(
      this.paymentMethods().map((method) => [method, this.expected(method)])
    );
    this.closingNote = '';
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

  countedDifference(method: PaymentMethod): number {
    return (this.closingAmounts[method] ?? 0) - this.expected(method);
  }

  closeSession(): void {
    const session = this.cashSession();

    if (!session || this.closing()) {
      return;
    }

    for (const method of this.paymentMethods()) {
      const amount = this.closingAmounts[method];

      if (amount === null || amount === undefined || amount < 0 || Number.isNaN(amount)) {
        this.error.set(`Ingresa el monto contado de ${this.paymentLabel(method)} (0 o más).`);
        return;
      }
    }

    this.closing.set(true);
    this.error.set('');

    const note = this.closingNote.trim();

    this.#cashSessionService
      .close(session._id, { closingAmounts: this.closingAmounts, note: note || undefined })
      .subscribe({
        next: (closed) => {
          this.closing.set(false);
          this.closingFormOpen.set(false);
          this.closedSession.set(closed);
          this.#store.setCashSession(null);
          this.#toast.ok('Caja cerrada correctamente.');
        },
        error: (err) => {
          this.closing.set(false);

          if (err.status === 409) {
            this.#toast.error('Esta caja ya estaba cerrada.');
            this.closingFormOpen.set(false);
            this.#loadCurrent();
            return;
          }

          this.error.set(err.error?.error ?? 'No se pudo cerrar la caja.');
        },
      });
  }

  closureLines(closed: CashSession): CashClosureLine[] {
    return (closed.closure ?? []).filter(
      (line) => line.expected !== 0 || line.counted !== 0 || this.paymentMethods().includes(line.method)
    );
  }

  totalDifference(closed: CashSession): number {
    return (closed.closure ?? []).reduce((sum, line) => sum + line.difference, 0);
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
    this.closedSession.set(null);
  }
}
