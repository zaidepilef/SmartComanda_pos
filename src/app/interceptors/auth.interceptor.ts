import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import { TOKEN_KEY } from '../services/auth.service';

export const FORBIDDEN_MESSAGE = 'Tu rol no permite esta acción.';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(TOKEN_KEY);
  const request = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      // Un 403 siempre se muestra igual, venga de donde venga.
      if (error instanceof HttpErrorResponse && error.status === 403) {
        return throwError(
          () =>
            new HttpErrorResponse({
              error: { error: FORBIDDEN_MESSAGE },
              headers: error.headers,
              status: error.status,
              statusText: error.statusText,
              url: error.url ?? undefined,
            })
        );
      }

      return throwError(() => error);
    })
  );
};
