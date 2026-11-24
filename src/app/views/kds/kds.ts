import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';

import { DeliveryInfo } from '../../components/delivery-info/delivery-info';
import { ToastService } from '../../components/toast/toast.service';
import {
  Order,
  OrderService,
  OrderStatus,
  ORDER_TYPE_LABELS,
} from '../../services/orders.service';
import { PosStore } from '../../store/pos-store.service';
import { AuthService } from '../../services/auth.service';
import { canDo } from '../../services/roles';

const POLL_INTERVAL_MS = 10000;

const STATUS_LABELS: Record<string, string> = {
  new: 'Nuevo',
  preparing: 'En preparación',
  ready: 'Listo',
};

const ADVANCE_LABELS: Partial<Record<OrderStatus, string>> = {
  new: 'Iniciar preparación',
  preparing: 'Marcar listo',
  ready: 'Entregar',
};

const formatCLP = (value: number): string =>
  `$${Math.round(value).toLocaleString('es-CL')}`;

@Component({
  selector: 'app-kds',
  imports: [DeliveryInfo],
  templateUrl: './kds.html',
  styleUrls: ['./kds.scss'],
})
export class KdsView implements OnInit, OnDestroy {
  readonly #orderService = inject(OrderService);
  readonly #store = inject(PosStore);
  readonly #toast = inject(ToastService);
  readonly #authService = inject(AuthService);

  /** Solo Encargado o superior anula pedidos (con motivo). */
  readonly canManage = computed(() => canDo(this.#authService.user(), 'cancel'));

  readonly loading = signal(false);
  readonly error = signal('');

  readonly newOrders = signal<Order[]>([]);
  readonly preparingOrders = signal<Order[]>([]);
  readonly readyOrders = signal<Order[]>([]);

  #timer: ReturnType<typeof setInterval> | null = null;

  get branchId(): string {
    return this.#store.branch()?._id ?? '';
  }

  ngOnInit(): void {
    this.#load();

    this.#timer = setInterval(() => {
      this.#load(false);
    }, POLL_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.#timer !== null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  #load(showLoading = true): void {
    if (!this.branchId) {
      return;
    }

    if (showLoading) {
      this.loading.set(true);
    }

    this.error.set('');

    this.#orderService
      .list({
        branchId: this.branchId,
        statuses: ['new', 'preparing', 'ready'],
        kitchen: true,
        limit: 200,
      })
      .subscribe({
        next: (orders) => {
          this.newOrders.set(orders.filter((order) => order.status === 'new'));
          this.preparingOrders.set(orders.filter((order) => order.status === 'preparing'));
          this.readyOrders.set(orders.filter((order) => order.status === 'ready'));
          this.loading.set(false);
        },
        error: () => {
          if (showLoading) {
            this.loading.set(false);
          }
          this.error.set('No se pudieron cargar los pedidos de cocina.');
        },
      });
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  orderTypeLabel(orderType: string): string {
    return ORDER_TYPE_LABELS[orderType as keyof typeof ORDER_TYPE_LABELS] ?? orderType;
  }

  elapsedMinutes(createdAt: string): number {
    return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  }

  elapsedLabel(createdAt: string): string {
    const minutes = this.elapsedMinutes(createdAt);

    if (minutes < 60) {
      return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  advance(order: Order): void {
    const next: Partial<Record<OrderStatus, OrderStatus>> = {
      new: 'preparing',
      preparing: 'ready',
      ready: 'delivered',
    };

    const target = next[order.status];

    if (!target) {
      return;
    }

    this.#orderService.updateStatus(order._id, target).subscribe({
      next: () => {
        this.#load(false);
      },
      error: (err) => {
        if (err.status === 409) {
          this.#load(false);
          return;
        }

        this.#toast.error(err.error?.error ?? 'No se pudo actualizar el pedido.');
      },
    });
  }

  cancel(order: Order): void {
    const paidNote = order.paymentStatus === 'paid' ? ' Se descontará de la caja.' : '';
    const reason = prompt(`Motivo para anular el pedido #${order.number}.${paidNote}`)?.trim();

    if (!reason) {
      return;
    }

    this.#orderService.cancel(order._id, reason.slice(0, 200)).subscribe({
      next: () => {
        this.#load(false);
        this.#toast.ok(`Pedido #${order.number} anulado.`);
      },
      error: (err) => {
        this.#load(false);
        this.#toast.error(
          err.status === 409
            ? 'No se puede anular: la caja donde se cobró ya está cerrada o el pedido cambió.'
            : (err.error?.error ?? 'No se pudo anular el pedido.')
        );
      },
    });
  }

  canCancel(order: Order): boolean {
    return this.canManage() && ['new', 'preparing', 'ready'].includes(order.status);
  }

  advanceLabel(order: Order): string {
    return ADVANCE_LABELS[order.status] ?? 'Avanzar';
  }

  formatCLP(value: number): string {
    return formatCLP(value);
  }
}