import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export type OrderType = 'takeaway' | 'dinein' | 'delivery' | 'qr';

export type PaymentMethod = 'cash' | 'debit' | 'credit' | 'transfer';

export type OrderStatus =
  | 'new'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'rejected'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'declined' | 'voided' | 'refunded';

/** Medio que el cliente dijo que usará (`card` = débito o crédito, decide en la puerta). */
export type ExpectedPaymentMethod = 'cash' | 'debit' | 'credit' | 'card';

/** Medios con los que el repartidor cobra en la entrega. */
export type CollectMethod = 'cash' | 'debit' | 'credit';

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  takeaway: 'Para llevar',
  dinein: 'En el local',
  delivery: 'Delivery',
  qr: 'Código QR',
};

export interface OrderItemInput {
  dishId: string;
  quantity: number;
  note?: string;
  stockApplied: boolean;
}

export interface OrderItem {
  dishId: string;
  name: string;
  price: number;
  quantity: number;
  stockApplied: boolean;
  note?: string;
}

export interface Order {
  _id: string;
  tenantId: string;
  foodtruckId: string;
  number: number;
  orderType: OrderType;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  clientContact?: string;
  clientName?: string;
  clientPhone?: string;
  items: OrderItem[];
  total: number;
  createdAt: string;
  status: OrderStatus;
  cancelReason?: string | null;
  /** Nombre de quien cobró el pedido (null si está pendiente o es anterior al registro). */
  paidByName?: string | null;
  correctedAt?: string | null;
  /** Entrega a domicilio pedida desde la app del cliente (ver change delivery-location-estimate). */
  deliveryAddress?: string | null;
  deliveryReference?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveryAccuracyM?: number | null;
  deliveryDistanceKm?: number | null;
  deliveryEtaMinutes?: number | null;
  deliveryOutOfRange?: boolean | null;
  /** Flujo de compra de la app (change customer-purchase-flow). */
  expectedPaymentMethod?: ExpectedPaymentMethod | null;
  cashTendered?: number | null;
  driverId?: string | null;
  driverName?: string | null;
  rejectionReason?: string | null;
}

export interface PayOrderResponse {
  order: Order;
  pointsEarned?: number;
}

export interface CreateOrderPayload {
  foodtruckId: string;
  clientContact?: string;
  clientPhone?: string;
  orderType: OrderType;
  paymentMethod?: PaymentMethod;
  items: OrderItemInput[];
}

export interface DeliverOrderResponse {
  order: Order;
  change: number;
  pointsEarned?: number;
}

export interface OrderWarning {
  dishId?: string;
  message: string;
}

export interface CreateOrderResponse {
  order: Order;
  warnings: OrderWarning[];
  pointsEarned?: number;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  readonly #http = inject(HttpClient);

  create(payload: CreateOrderPayload): Observable<CreateOrderResponse> {
    return this.#http.post<CreateOrderResponse>(`${environment.apiUrl}/api/orders`, payload);
  }

  list(params: {
    branchId: string;
    statuses?: OrderStatus[];
    orderType?: OrderType | OrderType[];
    paymentStatus?: Order['paymentStatus'];
    /** Vista de cocina: excluye pedidos de la app del cliente (QR o domicilio) sin cobrar. */
    kitchen?: boolean;
    /** Solo domicilios pedidos desde la app del cliente (pantalla Reparto). */
    appDeliveryOnly?: boolean;
    limit?: number;
  }): Observable<Order[]> {
    let httpParams = new HttpParams().set('branchId', params.branchId);

    if (params.statuses?.length) {
      params.statuses.forEach((status) => {
        httpParams = httpParams.append('status', status);
      });
    }

    const orderTypes = params.orderType === undefined ? [] : [params.orderType].flat();
    orderTypes.forEach((orderType) => {
      httpParams = httpParams.append('orderType', orderType);
    });

    if (params.paymentStatus) {
      httpParams = httpParams.set('paymentStatus', params.paymentStatus);
    }

    if (params.kitchen) {
      httpParams = httpParams.set('kitchen', 'true');
    }

    if (params.appDeliveryOnly) {
      httpParams = httpParams.set('appDeliveryOnly', 'true');
    }

    if (params.limit) {
      httpParams = httpParams.set('limit', String(params.limit));
    }

    return this.#http.get<Order[]>(`${environment.apiUrl}/api/orders`, {
      params: httpParams,
    });
  }

  pay(id: string, paymentMethod: PaymentMethod): Observable<PayOrderResponse> {
    return this.#http.patch<PayOrderResponse>(`${environment.apiUrl}/api/orders/${id}/pay`, {
      paymentMethod,
    });
  }

  cancel(id: string, reason: string): Observable<Order> {
    return this.#http.post<Order>(`${environment.apiUrl}/api/orders/${id}/cancel`, { reason });
  }

  correct(id: string, items: { dishId: string; quantity: number }[]): Observable<Order> {
    return this.#http.put<Order>(`${environment.apiUrl}/api/orders/${id}/items`, { items });
  }

  updateStatus(id: string, status: OrderStatus): Observable<Order> {
    return this.#http.patch<Order>(
      `${environment.apiUrl}/api/orders/${id}/status`,
      { status }
    );
  }

  /** Rechazo por el local (solo pedidos de la app en `new`, sin cobrar). */
  reject(id: string, reason: string): Observable<Order> {
    return this.#http.post<Order>(`${environment.apiUrl}/api/orders/${id}/reject`, { reason });
  }

  /** Sale a reparto. Sin `driverId` lo toma quien lo pide (repartidor). */
  dispatch(id: string, driverId?: string): Observable<Order> {
    return this.#http.post<Order>(
      `${environment.apiUrl}/api/orders/${id}/dispatch`,
      driverId ? { driverId } : {}
    );
  }

  assignDriver(id: string, driverId: string): Observable<Order> {
    return this.#http.put<Order>(`${environment.apiUrl}/api/orders/${id}/driver`, { driverId });
  }

  /** Entrega y cobro en la puerta, en una sola operación. */
  deliver(id: string, paymentMethod: CollectMethod, cashReceived?: number): Observable<DeliverOrderResponse> {
    return this.#http.post<DeliverOrderResponse>(`${environment.apiUrl}/api/orders/${id}/deliver`, {
      paymentMethod,
      ...(paymentMethod === 'cash' ? { cashReceived } : {}),
    });
  }

  /** La tarjeta fue rechazada en la puerta; el pedido sigue en reparto. */
  declinePayment(id: string, note?: string): Observable<Order> {
    return this.#http.post<Order>(
      `${environment.apiUrl}/api/orders/${id}/payment-declined`,
      note ? { note } : {}
    );
  }
}
