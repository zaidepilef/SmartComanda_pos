import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export type CashSessionStatus = 'open' | 'closed';

export type PaymentMethod = 'cash' | 'debit' | 'credit' | 'transfer';

export interface CashSessionTotals {
  cash: number;
  debit: number;
  credit: number;
  transfer: number;
}

export interface CashSession {
  _id: string;
  tenantId: string;
  branchId: string;
  openedBy: string;
  openedAt: string;
  openingAmount: number;
  status: CashSessionStatus;
  totals: CashSessionTotals;
  orderCount: number;
  closedAt: string | null;
  closedBy: string | null;
  closingAmounts?: CashSessionTotals | null;
  difference?: CashSessionTotals | null;
}

export interface OpenCashSessionPayload {
  branchId: string;
  openingAmount: number;
}

export type ClosingAmounts = Partial<Record<PaymentMethod, number>>;

@Injectable({ providedIn: 'root' })
export class CashSessionService {
  readonly #http = inject(HttpClient);

  open(payload: OpenCashSessionPayload): Observable<CashSession> {
    return this.#http.post<CashSession>(`${environment.apiUrl}/api/cash-sessions`, payload);
  }

  current(branchId: string): Observable<CashSession> {
    const params = new HttpParams().set('branchId', branchId);

    return this.#http.get<CashSession>(`${environment.apiUrl}/api/cash-sessions/current`, {
      params,
    });
  }

  close(id: string, payload: { closingAmounts?: ClosingAmounts }): Observable<CashSession> {
    return this.#http.post<CashSession>(
      `${environment.apiUrl}/api/cash-sessions/${id}/close`,
      payload
    );
  }
}