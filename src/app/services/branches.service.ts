import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export type BranchType = 'Sucursal' | 'FoodTruck';

export type PaymentMethod = 'cash' | 'debit' | 'credit' | 'transfer';

export interface Branch {
  _id: string;
  tenantId: string;
  name: string;
  type: BranchType;
  address?: string;
  city?: string;
  phone?: string;
  active: boolean;
  paymentMethods?: PaymentMethod[];
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  debit: 'Débito',
  credit: 'Crédito',
  transfer: 'Transferencia',
};

@Injectable({ providedIn: 'root' })
export class BranchService {
  readonly #http = inject(HttpClient);

  list(tenantId?: string, active?: 'true' | 'false'): Observable<Branch[]> {
    let params = new HttpParams();

    if (tenantId) {
      params = params.set('tenantId', tenantId);
    }

    if (active) {
      params = params.set('active', active);
    }

    return this.#http.get<Branch[]>(`${environment.apiUrl}/api/branches`, { params });
  }
}