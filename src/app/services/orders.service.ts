import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export type OrderType = 'takeaway' | 'dinein' | 'delivery' | 'qr';

export type PaymentMethod = 'cash' | 'debit' | 'credit' | 'transfer';

export type OrderStatus = 'new' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

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
  paymentStatus: string;
  paymentMethod?: PaymentMethod;
  clientContact?: string;
  clientName?: string;
  clientPhone?: string;
  items: OrderItem[];
  total: number;
  createdAt: string;
  status: OrderStatus;
}

export interface CreateOrderPayload {
  foodtruckId: string;
  clientContact?: string;
  clientPhone?: string;
  orderType: OrderType;
  paymentMethod?: PaymentMethod;
  items: OrderItemInput[];
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
    limit?: number;
  }): Observable<Order[]> {
    let httpParams = new HttpParams().set('branchId', params.branchId);

    if (params.statuses?.length) {
      params.statuses.forEach((status) => {
        httpParams = httpParams.append('status', status);
      });
    }

    if (params.limit) {
      httpParams = httpParams.set('limit', String(params.limit));
    }

    return this.#http.get<Order[]>(`${environment.apiUrl}/api/orders`, {
      params: httpParams,
    });
  }

  updateStatus(id: string, status: OrderStatus): Observable<Order> {
    return this.#http.patch<Order>(
      `${environment.apiUrl}/api/orders/${id}/status`,
      { status }
    );
  }
}