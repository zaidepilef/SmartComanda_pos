import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface Dish {
  _id: string;
  tenantId: string;
  name: string;
  salePrice: number;
  recipe: RecipeLine[];
  branchPrices?: BranchPrice[];
  cost?: number;
  active: boolean;
  description?: string;
  category?: string;
  icon?: string;
}

export interface RecipeLine {
  ingredientId: string;
  quantity: number;
  unit: string;
}

export interface BranchPrice {
  branchId: string;
  price: number;
}

@Injectable({ providedIn: 'root' })
export class DishService {
  readonly #http = inject(HttpClient);

  list(tenantId?: string, q?: string, branchId?: string): Observable<Dish[]> {
    let params = new HttpParams();

    if (tenantId) {
      params = params.set('tenantId', tenantId);
    }

    if (q && q.trim() !== '') {
      params = params.set('q', q.trim());
    }

    if (branchId) {
      params = params.set('branchId', branchId);
    }

    return this.#http.get<Dish[]>(`${environment.apiUrl}/api/dishes`, { params });
  }

  priceOf(dish: Dish, branchId?: string): number {
    if (branchId) {
      const entry = dish.branchPrices?.find((item) => item.branchId === branchId);

      if (entry) {
        return entry.price;
      }
    }

    return dish.salePrice;
  }
}