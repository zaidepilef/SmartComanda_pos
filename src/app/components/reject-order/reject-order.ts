import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PosModal } from '../pos-modal/pos-modal';
import { ToastService } from '../toast/toast.service';
import { Order, OrderService } from '../../services/orders.service';

const REASON_MIN = 3;
const REASON_MAX = 200;

/** Motivos frecuentes para no escribirlos cada vez. */
const QUICK_REASONS = ['Sin stock de un producto', 'Local por cerrar', 'Dirección no confiable', 'Pedido duplicado'];

/**
 * Rechazo de un pedido de la app por el local, con motivo obligatorio.
 * El cliente ve el motivo en su seguimiento.
 */
@Component({
  selector: 'app-reject-order',
  imports: [FormsModule, PosModal],
  template: `
    <app-pos-modal
      [open]="order() !== null"
      [title]="'Rechazar pedido #' + (order()?.number ?? '')"
      (closed)="close()"
    >
      <p class="sub">El cliente verá este motivo en su teléfono.</p>
      <div class="quick">
        @for (quick of quickReasons; track quick) {
          <button type="button" class="chip" (click)="reason.set(quick)">{{ quick }}</button>
        }
      </div>
      <label for="rejectReason">Motivo</label>
      <textarea
        id="rejectReason"
        rows="3"
        [maxlength]="reasonMax"
        [ngModel]="reason()"
        (ngModelChange)="reason.set($event)"
        name="rejectReason"
        placeholder="Ej.: no tenemos pan de completo"
      ></textarea>
      <button foot type="button" class="btn-danger" [disabled]="!valid() || submitting()" (click)="confirm()">
        {{ submitting() ? 'Rechazando…' : 'Rechazar pedido' }}
      </button>
    </app-pos-modal>
  `,
  styles: `
    .sub {
      color: var(--muted);
      font-size: 13px;
      margin: 0 0 10px;
    }
    .quick {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 10px;
    }
    .chip {
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--panel2);
      color: var(--text);
      font-size: 12px;
      cursor: pointer;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg2);
      color: var(--text);
      font: inherit;
    }
    .btn-danger {
      width: 100%;
      padding: 12px;
      border: none;
      border-radius: 10px;
      background: var(--danger);
      color: #fff;
      font-weight: 800;
      cursor: pointer;
    }
    .btn-danger:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
})
export class RejectOrder {
  readonly #orderService = inject(OrderService);
  readonly #toast = inject(ToastService);

  /** Pedido a rechazar; `null` cierra el diálogo. */
  readonly order = input<Order | null>(null);
  readonly closed = output<void>();
  readonly rejected = output<Order>();

  readonly quickReasons = QUICK_REASONS;
  readonly reasonMax = REASON_MAX;
  readonly reason = signal('');
  readonly submitting = signal(false);
  readonly valid = computed(() => {
    const length = this.reason().trim().length;
    return length >= REASON_MIN && length <= REASON_MAX;
  });

  constructor() {
    // Cada pedido empieza con el motivo vacío.
    effect(() => {
      this.order();
      this.reason.set('');
    });
  }

  close(): void {
    if (!this.submitting()) {
      this.closed.emit();
    }
  }

  confirm(): void {
    const order = this.order();

    if (!order || !this.valid() || this.submitting()) {
      return;
    }

    this.submitting.set(true);

    this.#orderService.reject(order._id, this.reason().trim()).subscribe({
      next: (updated) => {
        this.submitting.set(false);
        this.#toast.ok(`Pedido #${order.number} rechazado. El cliente verá el motivo.`);
        this.rejected.emit(updated);
      },
      error: (err) => {
        this.submitting.set(false);
        this.#toast.error(
          err.status === 409
            ? 'Ya no se puede rechazar: el pedido se cobró o cocina lo empezó. Anúlalo si corresponde.'
            : (err.error?.error ?? 'No se pudo rechazar el pedido.')
        );
        this.closed.emit();
      },
    });
  }
}
