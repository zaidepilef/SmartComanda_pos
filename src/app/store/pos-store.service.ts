import { Injectable, signal } from '@angular/core';

import { Branch } from '../services/branches.service';
import { CashSession } from '../services/cash-sessions.service';
import { Tenant } from '../services/tenants.service';

const TENANT_KEY = 'pos_tenant';
const BRANCH_KEY = 'pos_branch';
const SESSION_KEY = 'pos_cash_session';

@Injectable({ providedIn: 'root' })
export class PosStore {
  readonly tenant = signal<Tenant | null>(this.#readStoredJson<Tenant>(TENANT_KEY));
  readonly branch = signal<Branch | null>(this.#readStoredJson<Branch>(BRANCH_KEY));
  readonly cashSession = signal<CashSession | null>(
    this.#readStoredJson<CashSession>(SESSION_KEY)
  );

  setTenant(tenant: Tenant | null): void {
    this.tenant.set(tenant);
    this.#persistJson(TENANT_KEY, tenant);

    if (tenant === null) {
      this.setBranch(null);
    }
  }

  setBranch(branch: Branch | null): void {
    this.branch.set(branch);
    this.#persistJson(BRANCH_KEY, branch);

    if (branch === null) {
      this.setCashSession(null);
    }
  }

  setCashSession(session: CashSession | null): void {
    this.cashSession.set(session);
    this.#persistJson(SESSION_KEY, session);
  }

  clearContext(): void {
    this.setTenant(null);
  }

  #persistJson(key: string, value: unknown): void {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
      return;
    }

    localStorage.setItem(key, JSON.stringify(value));
  }

  #readStoredJson<T>(key: string): T | null {
    const raw = localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      localStorage.removeItem(key);
      return null;
    }
  }
}