import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { DeliveryInfo } from '../../components/delivery-info/delivery-info';
import { PosModal } from '../../components/pos-modal/pos-modal';
import { ToastService } from '../../components/toast/toast.service';
import { AuthService, AuthUser } from '../../services/auth.service';
import { CashSessionService } from '../../services/cash-sessions.service';
import {
  COLLECT_METHOD_LABELS,
  EXPECTED_METHOD_LABELS,
  collectOnDeliveryLabel,
  formatCLP,
} from '../../services/order-labels';
import { CollectMethod, Order, OrderService } from '../../services/orders.service';
import { canDo } from '../../services/roles';
import { UserService } from '../../services/users.service';
import { PosStore } from '../../store/pos-store.service';

const POLL_INTERVAL_MS = 10000;
const COLLECT_METHODS: CollectMethod[] = ['cash', 'debit', 'credit'];

/**
 * Reparto de los domicilios pedidos desde la app: salir a reparto, entregar y
 * cobrar en la puerta (efectivo con vuelto, débito o crédito) y registrar una
 * tarjeta rechazada. El Encargado asigna o reasigna repartidores.
 */
@Component({
  selector: 'app-delivery',
  imports: [FormsModule, NgTemplateOutlet, PosModal, DeliveryInfo],
  templateUrl: './delivery.html',
  styleUrls: ['./delivery.scss'],
})
export class DeliveryView implements OnInit, OnDestroy {
  readonly #orderService = inject(OrderService);
  readonly #userService = inject(UserService);
  readonly #cashSessionService = inject(CashSessionService);
  readonly #authService = inject(AuthService);
  readonly #store = inject(PosStore);
  readonly #toast = inject(ToastService);

  readonly formatCLP = formatCLP;
  readonly collectMethods = COLLECT_METHODS;
  readonly collectLabels = COLLECT_METHOD_LABELS;
  readonly expectedLabels = EXPECTED_METHOD_LABELS;

  readonly canAssign = computed(() => canDo(this.#authService.user(), 'assign'));
  /** Solo quien ve la caja puede saber si está abierta; al repartidor se le avisa al cobrar. */
  readonly canSeeCash = computed(() => canDo(this.#authService.user(), 'cash'));
  readonly cashSession = this.#store.cashSession;

  readonly orders = signal<Order[]>([]);
  readonly drivers = signal<AuthUser[]>([]);
  readonly loading = signal(true);
  /** Hora de referencia para los minutos transcurridos; se actualiza en cada consulta. */
  readonly now = signal(Date.now());
  readonly error = signal('');
  readonly busyId = signal<string | null>(null);

  readonly readyOrders = computed(() => this.orders().filter((order) => order.status === 'ready'));
  readonly outOrders = computed(() => this.orders().filter((order) => order.status === 'out_for_delivery'));

  /** Repartidor elegido por pedido (Encargado). */
  readonly driverChoice = signal<Record<string, string>>({});

  // Entrega y cobro
  readonly delivering = signal<Order | null>(null);
  readonly collectMethod = signal<CollectMethod | null>(null);
  readonly cashReceived = signal<number | null>(null);
  readonly submitting = signal(false);

  readonly change = computed(() => {
    const order = this.delivering();
    const received = this.cashReceived();
    return order && received !== null ? received - order.total : null;
  });

  readonly canConfirmDelivery = computed(() => {
    const method = this.collectMethod();
    const change = this.change();
    return method !== null && (method !== 'cash' || (change !== null && change >= 0));
  });

  #timer: ReturnType<typeof setInterval> | null = null;

  get branchId(): string {
    return this.#store.branch()?._id ?? '';
  }

  ngOnInit(): void {
    this.#load();
    this.#loadCashSession();

    if (this.canAssign()) {
      this.#userService.drivers(this.branchId).subscribe({
        next: (drivers) => this.drivers.set(drivers),
        error: () => this.drivers.set([]),
      });
    }

    this.#timer = setInterval(() => {
      this.#load(false);
      this.#loadCashSession();
    }, POLL_INTERVAL_MS);
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
        statuses: ['ready', 'out_for_delivery'],
        appDeliveryOnly: true,
        limit: 100,
      })
      .subscribe({
        next: (orders) => {
          this.now.set(Date.now());
          this.orders.set([...orders].reverse());
          this.error.set('');
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('No se pudieron cargar los repartos.');
        },
      });
  }

  #loadCashSession(): void {
    if (!this.canSeeCash() || !this.branchId) {
      return;
    }

    this.#cashSessionService.current(this.branchId).subscribe({
      next: (session) => this.#store.setCashSession(session),
    });
  }

  collectLabel(order: Order): string | null {
    return collectOnDeliveryLabel(order);
  }

  telUrl(order: Order): string | null {
    const phone = order.clientPhone?.replace(/[^\d+]/g, '');
    return phone ? `tel:${phone}` : null;
  }

  ageLabel(order: Order): string {
    const minutes = Math.max(0, Math.floor((this.now() - new Date(order.createdAt).getTime()) / 60000));
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  chosenDriver(order: Order): string {
    return this.driverChoice()[order._id] ?? order.driverId ?? '';
  }

  chooseDriver(order: Order, driverId: string): void {
    this.driverChoice.update((choices) => ({ ...choices, [order._id]: driverId }));
  }

  // ── Salir a reparto ─────────────────────────────────────────────────

  dispatch(order: Order): void {
    const driverId = this.canAssign() ? this.chosenDriver(order) || undefined : undefined;

    if (this.canAssign() && this.drivers().length > 0 && !driverId) {
      this.#toast.error('Elige el repartidor que llevará el pedido.');
      return;
    }

    this.busyId.set(order._id);

    this.#orderService.dispatch(order._id, driverId).subscribe({
      next: (updated) => {
        this.busyId.set(null);
        const who = updated.driverName ? ` con ${updated.driverName}` : '';
        this.#toast.ok(`Pedido #${order.number} salió a reparto${who}.`);
        this.#load(false);
      },
      error: (err) => {
        this.busyId.set(null);
        this.#toast.error(
          err.status === 409
            ? 'Otro repartidor ya tomó este pedido o cambió su estado.'
            : (err.error?.error ?? 'No se pudo enviar a reparto.')
        );
        this.#load(false);
      },
    });
  }

  reassign(order: Order): void {
    const driverId = this.chosenDriver(order);

    if (!driverId || driverId === order.driverId) {
      return;
    }

    this.busyId.set(order._id);

    this.#orderService.assignDriver(order._id, driverId).subscribe({
      next: (updated) => {
        this.busyId.set(null);
        this.#toast.ok(`Pedido #${order.number} asignado a ${updated.driverName ?? 'otro repartidor'}.`);
        this.#load(false);
      },
      error: (err) => {
        this.busyId.set(null);
        this.#toast.error(err.error?.error ?? 'No se pudo reasignar el pedido.');
        this.#load(false);
      },
    });
  }

  // ── Entregar y cobrar ───────────────────────────────────────────────

  startDeliver(order: Order): void {
    const expected = order.expectedPaymentMethod;
    const method: CollectMethod | null =
      expected === 'cash' || expected === 'debit' || expected === 'credit' ? expected : null;

    this.collectMethod.set(order.paymentStatus === 'declined' ? null : method);
    this.cashReceived.set(method === 'cash' ? (order.cashTendered ?? order.total) : null);
    this.delivering.set(order);
  }

  closeDeliver(): void {
    if (!this.submitting()) {
      this.delivering.set(null);
    }
  }

  setCollectMethod(method: CollectMethod): void {
    const order = this.delivering();
    this.collectMethod.set(method);
    this.cashReceived.set(method === 'cash' && order ? (order.cashTendered ?? order.total) : null);
  }

  confirmDeliver(): void {
    const order = this.delivering();
    const method = this.collectMethod();

    if (!order || !method || !this.canConfirmDelivery() || this.submitting()) {
      return;
    }

    this.submitting.set(true);

    this.#orderService
      .deliver(order._id, method, method === 'cash' ? (this.cashReceived() ?? undefined) : undefined)
      .subscribe({
        next: ({ change, pointsEarned }) => {
          this.submitting.set(false);
          this.delivering.set(null);
          const changeText = method === 'cash' && change > 0 ? ` · Vuelto ${formatCLP(change)}` : '';
          const points = pointsEarned ? ` · +${pointsEarned} puntos` : '';
          this.#toast.ok(`Pedido #${order.number} entregado y cobrado${changeText}${points}.`);
          this.#load(false);
          this.#loadCashSession();
        },
        error: (err) => {
          this.submitting.set(false);
          const message: string = err.error?.error ?? '';

          if (err.status === 409 && message.includes('cash session')) {
            this.#toast.error('No hay caja abierta en la sucursal. Avisa al Encargado para que la abra y vuelve a cobrar.');
            return;
          }

          this.delivering.set(null);
          this.#toast.error(
            err.status === 409
              ? 'El pedido ya se cobró o cambió de estado.'
              : err.status === 403
                ? 'Este reparto está asignado a otro repartidor.'
                : (message || 'No se pudo registrar la entrega.')
          );
          this.#load(false);
        },
      });
  }

  /** La tarjeta no pasó: queda registrado y el pedido sigue en reparto para cobrar con otro medio. */
  declineCard(): void {
    const order = this.delivering();

    if (!order || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    const method = this.collectMethod();
    const note = method && method !== 'cash' ? `Rechazo con ${COLLECT_METHOD_LABELS[method]}` : undefined;

    this.#orderService.declinePayment(order._id, note).subscribe({
      next: (updated) => {
        this.submitting.set(false);
        this.delivering.set(updated);
        this.collectMethod.set(null);
        this.cashReceived.set(null);
        this.#toast.error(`Tarjeta rechazada en el pedido #${order.number}. Cobra con otro medio.`);
        this.#load(false);
      },
      error: (err) => {
        this.submitting.set(false);
        this.#toast.error(err.error?.error ?? 'No se pudo registrar el rechazo.');
      },
    });
  }
}
