import { AuthUser, UserRole } from './auth.service';

/** Nombre visible de cada rol (el código nunca se muestra). */
export const ROLE_LABELS: Record<UserRole, string> = {
  sysadmin: 'Sistema',
  owner: 'Propietario',
  admin: 'Encargado',
  cashier: 'Cajero',
  cook: 'Cocinero',
};

const MANAGERS: UserRole[] = ['sysadmin', 'owner', 'admin'];
const CASH_STAFF: UserRole[] = [...MANAGERS, 'cashier'];

/** Acciones del POS, alineadas con la matriz de permisos de la API. */
export type PosAction = 'cash' | 'orders' | 'cancel' | 'correct';

const ACTION_ROLES: Record<PosAction, UserRole[]> = {
  cash: CASH_STAFF,
  orders: CASH_STAFF,
  cancel: MANAGERS,
  correct: MANAGERS,
};

export function userRoles(user: AuthUser | null): UserRole[] {
  if (!user) {
    return [];
  }
  if (user.roles?.length) {
    return user.roles;
  }
  return user.role ? [user.role] : [];
}

export function canDo(user: AuthUser | null, action: PosAction): boolean {
  return userRoles(user).some((role) => ACTION_ROLES[action].includes(role));
}

/** Pantalla de inicio según rol: el Cocinero entra directo a Cocina. */
export function homeRoute(user: AuthUser | null): string {
  return canDo(user, 'orders') ? '/pos' : '/kds';
}

export function roleLabel(user: AuthUser | null): string {
  const [role] = userRoles(user);
  return role ? ROLE_LABELS[role] : '';
}
