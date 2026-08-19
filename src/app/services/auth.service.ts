import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export type UserRole = 'sysadmin' | 'owner' | 'admin' | 'cashier';

export interface AuthUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  role?: UserRole;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  token: string;
  expiresIn: number;
  user: AuthUser;
}

export const TOKEN_KEY = 'pos_token';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'Invalid credentials.': 'Credenciales inválidas. Verifica tu email y contraseña.',
  'This account awaits verification.': 'Tu cuenta está pendiente de verificación interna.',
  'This account is inactive.': 'Tu cuenta está bloqueada.',
  'Captcha verification failed.': 'La verificación de seguridad falló. Intenta nuevamente.',
};

const GENERIC_ERROR_MESSAGE = 'No se pudo completar la operación. Intenta nuevamente.';

export function authErrorMessage(raw: string | undefined): string {
  return (raw && AUTH_ERROR_MESSAGES[raw]) || GENERIC_ERROR_MESSAGE;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly #http = inject(HttpClient);

  readonly #user = signal<AuthUser | null>(null);
  readonly user = this.#user.asReadonly();

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }

  setToken(token: string | null): void {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      this.#user.set(null);
    }
  }

  setUser(user: AuthUser): void {
    this.#user.set(user);
  }

  login(email: string, password: string, captchaToken: string): Observable<AuthResponse> {
    return this.#http.post<AuthResponse>(`${environment.apiUrl}/api/auth/login`, {
      email,
      password,
      captchaToken,
    });
  }

  me(): Observable<AuthUser> {
    return this.#http.get<AuthUser>(`${environment.apiUrl}/api/auth/me`);
  }

  logout(): Observable<void> {
    return this.#http.post<void>(`${environment.apiUrl}/api/auth/logout`, {});
  }
}