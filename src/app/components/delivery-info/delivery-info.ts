import { Component, computed, input } from '@angular/core';

import { Order } from '../../services/orders.service';

/**
 * Datos de entrega de un pedido a domicilio: dirección, referencia, estimación,
 * aviso de fuera de rango y link al mapa. No muestra nada si el pedido no tiene dirección.
 */
@Component({
  selector: 'app-delivery-info',
  template: `
    @if (order().deliveryAddress) {
      <div class="delivery-info" [class.out]="order().deliveryOutOfRange">
        <div class="address">🛵 {{ order().deliveryAddress }}</div>
        @if (order().deliveryReference) {
          <div class="reference">{{ order().deliveryReference }}</div>
        }
        <div class="row">
          @if (estimate(); as label) {
            <span class="estimate">{{ label }}</span>
          }
          @if (order().deliveryOutOfRange) {
            <span class="badge">Fuera de rango</span>
          }
          @if (mapUrl(); as url) {
            <a [href]="url" target="_blank" rel="noopener">Ver en mapa</a>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .delivery-info {
      margin: 6px 0 8px;
      padding: 8px 10px;
      border-radius: 8px;
      background: var(--panel2);
      border: 1px solid var(--border);
      font-size: 13px;
    }
    .delivery-info.out {
      border-color: var(--accent2);
    }
    .address {
      font-weight: 600;
      color: var(--text);
    }
    .reference {
      color: var(--muted);
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }
    .estimate {
      color: var(--text);
    }
    .badge {
      padding: 1px 8px;
      border-radius: 999px;
      background: var(--accent2);
      color: #1a1d22;
      font-size: 11px;
      font-weight: 700;
    }
    a {
      color: var(--accent2);
      font-weight: 600;
    }
  `,
})
export class DeliveryInfo {
  readonly order = input.required<Order>();

  readonly mapUrl = computed(() => {
    const { deliveryLat, deliveryLng } = this.order();
    return deliveryLat != null && deliveryLng != null
      ? `https://www.google.com/maps?q=${deliveryLat},${deliveryLng}`
      : null;
  });

  readonly estimate = computed(() => {
    const { deliveryDistanceKm, deliveryEtaMinutes } = this.order();

    if (deliveryDistanceKm == null || deliveryEtaMinutes == null) {
      return null;
    }

    const km = deliveryDistanceKm.toLocaleString('es-CL', { maximumFractionDigits: 1 });
    return `${km} km · ~${deliveryEtaMinutes} min`;
  });
}
