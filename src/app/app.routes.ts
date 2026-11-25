import { Routes } from '@angular/router';

import { authGuard } from './guards/auth.guard';
import { contextGuard } from './guards/context.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./views/login/login').then((m) => m.LoginView) },
  {
    path: 'tenant-picker',
    canActivate: [authGuard],
    loadComponent: () => import('./views/tenant-picker/tenant-picker').then((m) => m.TenantPicker),
  },
  {
    path: 'branch-picker',
    canActivate: [authGuard],
    loadComponent: () => import('./views/branch-picker/branch-picker').then((m) => m.BranchPicker),
  },
  {
    path: 'pos',
    canActivate: [authGuard, roleGuard('orders'), contextGuard],
    loadComponent: () => import('./views/pos/pos').then((m) => m.PosView),
  },
  {
    path: 'cash',
    canActivate: [authGuard, roleGuard('cash'), contextGuard],
    loadComponent: () => import('./views/cash/cash').then((m) => m.CashView),
  },
  {
    path: 'qr',
    canActivate: [authGuard, roleGuard('orders'), contextGuard],
    loadComponent: () => import('./views/qr-orders/qr-orders').then((m) => m.QrOrdersView),
  },
  {
    path: 'kds',
    canActivate: [authGuard, roleGuard('kitchen'), contextGuard],
    loadComponent: () => import('./views/kds/kds').then((m) => m.KdsView),
  },
  {
    path: 'delivery',
    canActivate: [authGuard, roleGuard('dispatch'), contextGuard],
    loadComponent: () => import('./views/delivery/delivery').then((m) => m.DeliveryView),
  },
  { path: '', pathMatch: 'full', redirectTo: 'pos' },
  { path: '**', redirectTo: 'pos' },
];