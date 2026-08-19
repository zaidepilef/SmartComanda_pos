import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { PosModal } from '../../components/pos-modal/pos-modal';
import { ToastService } from '../../components/toast/toast.service';
import { Branch } from '../../services/branches.service';
import {
  CashSessionService,
  CashSession,
} from '../../services/cash-sessions.service';
import { Dish, DishService } from '../../services/dishes.service';
import {
  CreateOrderResponse,
  OrderService,
  OrderType,
  PaymentMethod,
  ORDER_TYPE_LABELS,
} from '../../services/orders.service';
import { PAYMENT_METHOD_LABELS } from '../../services/branches.service';
import { TenantService } from '../../services/tenants.service';
import { PosStore } from '../../store/pos-store.service';

interface CartItem {
  dish: Dish;
  quantity: number;
  note: string;
}

interface ItemModalState {
  dish: Dish;
  quantity: number;
  note: string;
}

const formatCLP = (value: number): string =>
  `$${Math.round(value).toLocaleString('es-CL')}`;

@Component({
  selector: 'app-pos',
  imports: [FormsModule, PosModal],
  templateUrl: './pos.html',
  styleUrls: ['./pos.scss'],
})
export class PosView implements OnInit {
  readonly #dishService = inject(DishService);
  readonly #orderService = inject(OrderService);
  readonly #cashSessionService = inject(CashSessionService);
  readonly #tenantService = inject(TenantService);
  readonly #store = inject(PosStore);
  readonly #toast = inject(ToastService);
  readonly #router = inject(Router);

  readonly branch = this.#store.branch;
  readonly cashSession = this.#store.cashSession;

  readonly dishes = signal<Dish[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly categories = signal<string[]>([]);
  readonly activeCategory = signal('');

  readonly search = signal('');
  readonly cart = signal<CartItem[]>([]);

  readonly itemModal = signal<ItemModalState | null>(null);
  readonly orderModalOpen = signal(false);
  readonly paymentModalOpen = signal(false);

  readonly orderTypes: OrderType[] = ['takeaway', 'dinein', 'delivery', 'qr'];

  readonly clientContact = signal('');
  readonly clientPhone = signal('');
  readonly orderType = signal<OrderType>('takeaway');

  readonly pointsRate = signal<number | null>(null);
  readonly paymentMethod = signal<PaymentMethod | null>(null);
  readonly cashReceived = signal<number | null>(null);

  readonly submitting = signal(false);
  readonly lastOrder = signal<CreateOrderResponse | null>(null);

  lastReceived: number | null = null;
  lastChange = 0;

  get branchId(): string {
    return this.#store.branch()?._id ?? '';
  }

  ngOnInit(): void {
    this.#loadDishes();
    this.#loadCashSession();
  }

  #loadDishes(): void {
    this.loading.set(true);
    this.error.set('');

    this.#dishService.list(this.#store.tenant()?._id, undefined, this.branchId).subscribe({
      next: (dishes) => {
        this.dishes.set(dishes.filter((dish) => dish.active));
        this.categories.set(
          Array.from(new Set(this.dishes().map((dish) => dish.category || 'general')))
        );

        if (!this.categories().includes(this.activeCategory())) {
          this.activeCategory.set(this.categories()[0] ?? '');
        }

        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudieron cargar los platos.');
      },
    });
  }

  #loadCashSession(): void {
    this.#cashSessionService.current(this.branchId).subscribe({
      next: (session) => this.#store.setCashSession(session),
      error: (err) => {
        if (err.status === 404) {
          this.#store.setCashSession(null);
        }
      },
    });
  }

  visibleDishes(): Dish[] {
    const query = this.search().trim().toLowerCase();

    return this.dishes().filter((dish) => {
      const inCategory = !this.activeCategory() || dish.category === this.activeCategory();
      const matches = !query || dish.name.toLowerCase().includes(query);

      return inCategory && matches;
    });
  }

  categoryIcon(category: string): string {
    const dish = this.dishes().find((item) => item.category === category);

    return dish?.icon || '🍽️';
  }

  selectCategory(category: string): void {
    this.activeCategory.set(category);
  }

  onSearchChange(value: string): void {
    this.search.set(value);
  }

  priceOf(dish: Dish): number {
    return this.#dishService.priceOf(dish, this.branchId);
  }

  openItemModal(dish: Dish): void {
    this.itemModal.set({ dish, quantity: 1, note: '' });
  }

  closeItemModal(): void {
    this.itemModal.set(null);
  }

  addToCart(): void {
    const modal = this.itemModal();

    if (!modal || modal.quantity <= 0) {
      return;
    }

    this.cart.update((items) => {
      const existing = items.find((item) => item.dish._id === modal.dish._id);

      if (existing) {
        return items.map((item) =>
          item === existing
            ? {
                ...item,
                quantity: item.quantity + modal.quantity,
                note: item.note || modal.note.trim(),
              }
            : item
        );
      }

      return [...items, { dish: modal.dish, quantity: modal.quantity, note: modal.note.trim() }];
    });

    this.itemModal.set(null);
  }

  decreaseItemQuantity(): void {
    this.itemModal.update((modal) =>
      modal ? { ...modal, quantity: Math.max(1, modal.quantity - 1) } : modal
    );
  }

  increaseItemQuantity(): void {
    this.itemModal.update((modal) =>
      modal ? { ...modal, quantity: modal.quantity + 1 } : modal
    );
  }

  changeQuantity(item: CartItem, delta: number): void {
    this.cart.update((items) =>
      items
        .map((entry) =>
          entry === item ? { ...entry, quantity: entry.quantity + delta } : entry
        )
        .filter((entry) => entry.quantity > 0)
    );
  }

  editNote(item: CartItem): void {
    const note = prompt('Observación para el plato:', item.note || '');

    if (note !== null) {
      this.cart.update((items) =>
        items.map((entry) => (entry === item ? { ...entry, note: note.trim() } : entry))
      );
    }
  }

  removeItem(item: CartItem): void {
    this.cart.update((items) => items.filter((entry) => entry !== item));
  }

  clearCart(): void {
    this.cart.set([]);
  }

  subtotal(): number {
    return this.cart().reduce(
      (sum, item) => sum + this.priceOf(item.dish) * item.quantity,
      0
    );
  }

  total(): number {
    return this.subtotal();
  }

  formatCLP(value: number): string {
    return formatCLP(value);
  }

  canCharge(): boolean {
    return this.cart().length > 0 && this.cashSession() !== null && !this.submitting();
  }

  openOrderModal(): void {
    this.clientContact.set('');
    this.clientPhone.set('');
    this.orderType.set('takeaway');
    this.orderModalOpen.set(true);
  }

  closeOrderModal(): void {
    this.orderModalOpen.set(false);
  }

  selectOrderType(type: OrderType): void {
    this.orderType.set(type);
  }

  openPaymentModal(): void {
    this.orderModalOpen.set(false);
    this.paymentMethod.set(null);
    this.cashReceived.set(null);
    this.paymentModalOpen.set(true);
    this.#loadPointsRate();
  }

  #loadPointsRate(): void {
    const tenantId = this.#store.tenant()?._id;

    if (!tenantId) {
      this.pointsRate.set(null);
      return;
    }

    this.#tenantService.get(tenantId).subscribe({
      next: (tenant) => this.pointsRate.set(tenant.loyalty?.pointsPerAmount ?? null),
      error: () => this.pointsRate.set(null),
    });
  }

  pointsPreview(): number {
    const rate = this.pointsRate();

    if (this.orderType() !== 'qr' || !this.clientPhone().trim() || !rate || rate <= 0) {
      return 0;
    }

    return Math.floor(this.total() / rate);
  }

  closePaymentModal(): void {
    this.paymentModalOpen.set(false);
  }

  branchPaymentMethods(): PaymentMethod[] {
    const branch = this.#store.branch();

    return branch?.paymentMethods?.length ? branch.paymentMethods : ['cash'];
  }

  paymentLabel(method: PaymentMethod): string {
    return PAYMENT_METHOD_LABELS[method] ?? method;
  }

  orderTypeLabel(type: OrderType): string {
    return ORDER_TYPE_LABELS[type] ?? type;
  }

  onPaymentMethodChange(method: PaymentMethod): void {
    this.paymentMethod.set(method);
    this.cashReceived.set(null);
  }

  cashChange(): number {
    const received = this.cashReceived() ?? 0;

    return Math.max(0, received - this.total());
  }

  canConfirmPayment(): boolean {
    if (!this.paymentMethod()) {
      return false;
    }

    if (this.paymentMethod() === 'cash') {
      return (this.cashReceived() ?? 0) >= this.total();
    }

    return true;
  }

  submitOrder(): void {
    const method = this.paymentMethod();

    if (!method || !this.canConfirmPayment()) {
      return;
    }

    this.submitting.set(true);

    this.#orderService
      .create({
        foodtruckId: this.branchId,
        clientContact: this.clientContact().trim() || undefined,
        clientPhone: this.clientPhone().trim() || undefined,
        orderType: this.orderType(),
        paymentMethod: method,
        items: this.cart().map((item) => ({
          dishId: item.dish._id,
          quantity: item.quantity,
          note: item.note || undefined,
          stockApplied: true,
        })),
      })
      .subscribe({
        next: (response) => {
          this.submitting.set(false);
          this.paymentModalOpen.set(false);
          this.lastOrder.set(response);
          this.lastReceived = this.paymentMethod() === 'cash' ? (this.cashReceived() ?? 0) : null;
          this.lastChange = this.paymentMethod() === 'cash' ? this.cashChange() : 0;
          this.cart.set([]);
          this.#loadCashSession();

          if (response.warnings.length > 0) {
            this.#toast.error(
              `Pedido #${response.order.number} creado con advertencias de stock.`
            );
          } else {
            this.#toast.ok(`Pedido #${response.order.number} cobrado correctamente.`);
          }
        },
        error: (err) => {
          this.submitting.set(false);

          if (err.status === 409) {
            this.paymentModalOpen.set(false);
            this.#store.setCashSession(null);
            this.#toast.error('No hay una caja abierta para esta sucursal.');
            void this.#router.navigate(['/cash']);
            return;
          }

          this.#toast.error(err.error?.error ?? 'No se pudo crear el pedido.');
        },
      });
  }

  dismissLastOrder(): void {
    this.lastOrder.set(null);
    this.lastReceived = null;
    this.lastChange = 0;
  }

  receiptDateLabel(order: { createdAt?: string }): string {
    return new Date(order.createdAt ?? Date.now()).toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  printReceipt(): void {
    window.print();
  }

  goToCaja(): void {
    void this.#router.navigate(['/cash']);
  }
}
