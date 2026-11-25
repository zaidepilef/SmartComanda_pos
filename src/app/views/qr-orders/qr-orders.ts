import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { DeliveryInfo } from '../../components/delivery-info/delivery-info';
import { RejectOrder } from '../../components/reject-order/reject-order';
import { PosModal } from '../../components/pos-modal/pos-modal';
import { ToastService } from '../../components/toast/toast.service';
import { AuthService } from '../../services/auth.service';
import { PAYMENT_METHOD_LABELS } from '../../services/branches.service';
import { CashSessionService } from '../../services/cash-sessions.service';
import { Order, OrderService, PaymentMethod } from '../../services/orders.service';
import { canDo } from '../../services/roles';
import { EXPECTED_METHOD_LABELS, preselectedMethod } from '../../services/order-labels';
import { PosStore } from '../../store/pos-store.service';

const POLL_INTERVAL_MS = 10000;

const formatCLP = (value: number): string =>
  `$${Math.round(value).toLocaleString('es-CL')}`;

interface CorrectionLine {
  dishId: string;
  name: string;
  price: number;
  quantity: number;
}

/**
 * Retiros pedidos desde la app pendientes de cobro: el Cajero los cobra (y pasan
 * a cocina) o los rechaza con motivo; Encargado o superior también puede corregirlos
 * o anularlos. Los domicilios de la app no pasan por aquí: entran a cocina y se
 * cobran al entregar (pantalla Reparto).
 */
@Component({
  selector: 'app-qr-orders',
  imports: [FormsModule, PosModal, DeliveryInfo, RejectOrder],
  templateUrl: './qr-orders.html',
  styleUrls: ['./qr-orders.scss'],
})
export class QrOrdersView implements OnInit, OnDestroy {
  readonly #orderService = inject(OrderService);
  readonly #cashSessionService = inject(CashSessionService);
  readonly #authService = inject(AuthService);
  readonly #store = inject(PosStore);
  readonly #toast = inject(ToastService);
  readonly #router = inject(Router);

  readonly cashSession = this.#store.cashSession;
  readonly orders = signal<Order[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly now = signal(Date.now());

  readonly canManage = computed(() => canDo(this.#authService.user(), 'cancel'));
  readonly canReject = computed(() => canDo(this.#authService.user(), 'reject'));
  readonly rejecting = signal<Order | null>(null);
  readonly expectedLabels = EXPECTED_METHOD_LABELS;

  readonly charging = signal<Order | null>(null);
  readonly paymentMethod = signal<PaymentMethod | null>(null);
  readonly cashReceived = signal<number | null>(null);
  readonly submitting = signal(false);

  readonly correcting = signal<Order | null>(null);
  readonly correctionLines = signal<CorrectionLine[]>([]);
  readonly correctionTotal = computed(() =>
    this.correctionLines().reduce((sum, line) => sum + line.price * line.quantity, 0)
  );

  #timer: ReturnType<typeof setInterval> | null = null;

  get branchId(): string {
    return this.#store.branch()?._id ?? '';
  }

  ngOnInit(): void {
    this.#load();
    this.#loadCashSession();
    this.#timer = setInterval(() => this.#load(false), POLL_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.#timer !== null) {
      clearInterval(this.#timer);
    }
  }

  #load(showLoading = true): void {
    if (!this.branchId) {
      return;
    }

    if (showLoading) {
      this.loading.set(true);
    }

    this.#orderService
      .list({
        branchId: this.branchId,
        orderType: 'qr',
        paymentStatus: 'pending',
        statuses: ['new'],
        limit: 100,
      })
      .subscribe({
        next: (orders) => {
          // Los más antiguos primero: son los que llevan más tiempo esperando.
          this.orders.set([...orders].reverse());
          this.now.set(Date.now());
          this.error.set('');
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('No se pudieron cargar los pedidos de la app.');
        },
      });
  }

  #loadCashSession(): void {
    this.#cashSessionService.current(this.branchId).subscribe({
      next: (session) => this.#store.setCashSession(session),
    });
  }

  #ageMinutes(order: Order): number {
    return Math.max(0, Math.floor((this.now() - new Date(order.createdAt).getTime()) / 60000));
  }

  /** Lleva 10 minutos o más esperando cobro. */
  isLate(order: Order): boolean {
    return this.#ageMinutes(order) >= 10;
  }

  ageLabel(order: Order): string {
    const minutes = this.#ageMinutes(order);
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  formatCLP(value: number): string {
    return formatCLP(value);
  }

  paymentLabel(method: PaymentMethod): string {
    return PAYMENT_METHOD_LABELS[method] ?? method;
  }

  branchPaymentMethods(): PaymentMethod[] {
    const methods = this.#store.branch()?.paymentMethods ?? [];
    const supported: PaymentMethod[] = ['cash', 'debit', 'credit', 'transfer'];
    const enabled = supported.filter((method) => methods.includes(method));
    return enabled.length ? enabled : ['cash'];
  }

  // ── Cobrar ──────────────────────────────────────────────────────────

  startCharge(order: Order): void {
    if (!this.cashSession()) {
      this.#toast.error('Abre la caja antes de cobrar.');
      void this.#router.navigate(['/cash']);
      return;
    }

    // Se preselecciona el medio que el cliente dijo que usaría (se puede cambiar).
    const method = preselectedMethod(order, this.branchPaymentMethods());
    this.paymentMethod.set(method);
    this.cashReceived.set(method === 'cash' ? (order.cashTendered ?? null) : null);
    this.charging.set(order);
  }

  closeCharge(): void {
    if (!this.submitting()) {
      this.charging.set(null);
    }
  }

  cashChange(): number {
    return Math.max(0, (this.cashReceived() ?? 0) - (this.charging()?.total ?? 0));
  }

  canConfirmPayment(): boolean {
    const order = this.charging();

    if (!order || !this.paymentMethod()) {
      return false;
    }

    return this.paymentMethod() !== 'cash' || (this.cashReceived() ?? 0) >= order.total;
  }

  confirmCharge(): void {
    const order = this.charging();
    const method = this.paymentMethod();

    if (!order || !method || !this.canConfirmPayment() || this.submitting()) {
      return;
    }

    this.submitting.set(true);

    this.#orderService.pay(order._id, method).subscribe({
      next: ({ order: paid, pointsEarned }) => {
        this.submitting.set(false);
        this.charging.set(null);
        const points = pointsEarned ? ` · +${pointsEarned} puntos` : '';
        this.#toast.ok(`Pedido #${paid.number} cobrado. Enviado a cocina${points}.`);
        this.#load(false);
        this.#loadCashSession();
      },
      error: (err) => {
        this.submitting.set(false);

        if (err.status === 409) {
          this.charging.set(null);
          this.#toast.error(err.error?.error?.includes('cash session')
            ? 'No hay una caja abierta para esta sucursal.'
            : 'El pedido ya no está pendiente de cobro.');
          this.#load(false);
          this.#loadCashSession();
          return;
        }

        this.#toast.error(err.error?.error ?? 'No se pudo cobrar el pedido.');
      },
    });
  }

  // ── Corregir (Encargado o superior) ─────────────────────────────────

  startCorrect(order: Order): void {
    this.correctionLines.set(
      order.items.map((item) => ({
        dishId: item.dishId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }))
    );
    this.correcting.set(order);
  }

  closeCorrect(): void {
    if (!this.submitting()) {
      this.correcting.set(null);
    }
  }

  changeLine(line: CorrectionLine, delta: number): void {
    this.correctionLines.update((lines) =>
      lines.map((entry) =>
        entry === line ? { ...entry, quantity: Math.max(0, Math.min(99, entry.quantity + delta)) } : entry
      )
    );
  }

  confirmCorrect(): void {
    const order = this.correcting();
    const items = this.correctionLines()
      .filter((line) => line.quantity > 0)
      .map(({ dishId, quantity }) => ({ dishId, quantity }));

    if (!order || this.submitting()) {
      return;
    }

    if (items.length === 0) {
      this.#toast.error('El pedido debe tener al menos un plato. Para eliminarlo, anúlalo.');
      return;
    }

    this.submitting.set(true);

    this.#orderService.correct(order._id, items).subscribe({
      next: (updated) => {
        this.submitting.set(false);
        this.correcting.set(null);
        this.#toast.ok(`Pedido #${updated.number} corregido: ${formatCLP(updated.total)}.`);
        this.#load(false);
      },
      error: (err) => {
        this.submitting.set(false);
        this.#toast.error(
          err.status === 409
            ? 'El pedido ya se cobró o cocina lo empezó; no se puede corregir.'
            : (err.error?.error ?? 'No se pudo corregir el pedido.')
        );
        this.#load(false);
      },
    });
  }

  // ── Rechazar (Cajero o superior) ────────────────────────────────────

  startReject(order: Order): void {
    this.rejecting.set(order);
  }

  onRejected(): void {
    this.rejecting.set(null);
    this.#load(false);
  }

  // ── Anular (Encargado o superior) ───────────────────────────────────

  cancel(order: Order): void {
    const reason = prompt(`Motivo para anular el pedido #${order.number}:`)?.trim();

    if (!reason) {
      return;
    }

    this.#orderService.cancel(order._id, reason.slice(0, 200)).subscribe({
      next: () => {
        this.#toast.ok(`Pedido #${order.number} anulado.`);
        this.#load(false);
      },
      error: (err) => {
        this.#toast.error(err.error?.error ?? 'No se pudo anular el pedido.');
        this.#load(false);
      },
    });
  }
}
