import { AuthUser, UserRole } from './auth.service';

/** Nombre visible de cada rol (el código nunca se muestra). */
export const ROLE_LABELS: Record<UserRole, string> = {
  sysadmin: 'Sistema',
  owner: 'Propietario',
  admin: 'Encargado',
  cashier: 'Cajero',
  cook: 'Cocinero',
  driver: 'Repartidor',
};

const MANAGERS: UserRole[] = ['sysadmin', 'owner', 'admin'];
const CASH_STAFF: UserRole[] = [...MANAGERS, 'cashier'];
const KITCHEN_STAFF: UserRole[] = [...CASH_STAFF, 'cook'];
const DISPATCH_STAFF: UserRole[] = [...MANAGERS, 'driver'];

/** Acciones del POS, alineadas con la matriz de permisos de la API. */
export type PosAction =
  | 'cash'
  | 'orders'
  | 'cancel'
  | 'correct'
  | 'kitchen'
  | 'reject'
  | 'dispatch'
  | 'assign';

const ACTION_ROLES: Record<PosAction, UserRole[]> = {
  cash: CASH_STAFF,
  orders: CASH_STAFF,
  cancel: MANAGERS,
  correct: MANAGERS,
  kitchen: KITCHEN_STAFF,
  reject: CASH_STAFF,
  dispatch: DISPATCH_STAFF,
  assign: MANAGERS,
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

/** Pantalla de inicio según rol: Cocinero → Cocina, Repartidor → Reparto. */
export function homeRoute(user: AuthUser | null): string {
  if (canDo(user, 'orders')) {
    return '/pos';
  }
  return canDo(user, 'kitchen') ? '/kds' : '/delivery';
}

export function roleLabel(user: AuthUser | null): string {
  const [role] = userRoles(user);
  return role ? ROLE_LABELS[role] : '';
}
