import { CollectMethod, ExpectedPaymentMethod, Order, PaymentMethod } from './orders.service';

/**
 * Etiquetas de estado y pago según la modalidad del pedido (retiro de la app,
 * domicilio de la app o pedido del POS). Compartidas por Cocina, Por cobrar y Reparto.
 */

export const formatCLP = (value: number): string => `$${Math.round(value).toLocaleString('es-CL')}`;

/** Retiro pedido desde la app: se cobra en caja antes de cocina. */
export function isAppPickup(order: Order): boolean {
  return order.orderType === 'qr';
}

/** Domicilio pedido desde la app: entra a cocina sin cobrar y se cobra al entregar. */
export function isAppDelivery(order: Order): boolean {
  return order.orderType === 'delivery' && Boolean(order.deliveryAddress);
}

export function isAppOrder(order: Order): boolean {
  return isAppPickup(order) || isAppDelivery(order);
}

export const EXPECTED_METHOD_LABELS: Record<ExpectedPaymentMethod, string> = {
  cash: 'Efectivo',
  debit: 'Débito',
  credit: 'Crédito',
  card: 'Tarjeta',
};

export const COLLECT_METHOD_LABELS: Record<CollectMethod, string> = {
  cash: 'Efectivo',
  debit: 'Débito',
  credit: 'Crédito',
};

/** Estado operativo visible, distinto por modalidad. */
export function statusLabel(order: Order): string {
  const delivery = isAppDelivery(order);

  switch (order.status) {
    case 'new':
      if (isAppPickup(order) && order.paymentStatus !== 'paid') {
        return 'Pendiente de pago';
      }
      return 'Nuevo';
    case 'preparing':
      return 'En preparación';
    case 'ready':
      return delivery ? 'Listo para despacho' : isAppPickup(order) ? 'Listo para retirar' : 'Listo';
    case 'out_for_delivery':
      return 'En reparto';
    case 'delivered':
      return 'Entregado';
    case 'rejected':
      return 'Rechazado';
    default:
      return 'Anulado';
  }
}

/**
 * Distintivo de pago para domicilios de la app pendientes:
 * "Paga al recibir $7.000 · Efectivo (paga con $10.000, vuelto $3.000)".
 */
export function collectOnDeliveryLabel(order: Order): string | null {
  if (!isAppDelivery(order) || (order.paymentStatus !== 'pending' && order.paymentStatus !== 'declined')) {
    return null;
  }

  const parts = [`Paga al recibir ${formatCLP(order.total)}`];

  if (order.expectedPaymentMethod) {
    parts.push(EXPECTED_METHOD_LABELS[order.expectedPaymentMethod]);
  }

  let label = parts.join(' · ');

  if (order.expectedPaymentMethod === 'cash' && order.cashTendered && order.cashTendered > order.total) {
    label += ` (paga con ${formatCLP(order.cashTendered)}, vuelto ${formatCLP(order.cashTendered - order.total)})`;
  }

  if (order.paymentStatus === 'declined') {
    label += ' · Tarjeta rechazada';
  }

  return label;
}

/** Medio del POS que corresponde al esperado (para preseleccionarlo al cobrar). */
export function preselectedMethod(
  order: Order,
  enabled: readonly PaymentMethod[]
): PaymentMethod | null {
  const expected = order.expectedPaymentMethod;

  if (expected && expected !== 'card' && enabled.includes(expected)) {
    return expected;
  }

  return null;
}
