import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthUser } from './auth.service';

interface UserPage {
  data: AuthUser[];
}

@Injectable({ providedIn: 'root' })
export class UserService {
  readonly #http = inject(HttpClient);

  /**
   * Repartidores activos que pueden atender la sucursal (asignados a ella o sin sucursal).
   * Solo lo usa Encargado o superior para asignar repartos.
   */
  drivers(branchId: string): Observable<AuthUser[]> {
    const params = new HttpParams().set('status', 'active').set('limit', '100');

    return this.#http.get<UserPage>(`${environment.apiUrl}/api/users`, { params }).pipe(
      map((page) =>
        (page.data ?? []).filter(
          (user) =>
            (user.roles ?? (user.role ? [user.role] : [])).includes('driver') &&
            (!user.branchId || String(user.branchId) === branchId)
        )
      )
    );
  }
}
