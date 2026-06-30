import { Role } from '@prisma/client';

export type Permission =
  | 'products.read'
  | 'products.create'
  | 'products.update'
  | 'products.delete'
  | 'inventory.read'
  | 'inventory.write'
  | 'inventory.delete'
  | 'sales.read'
  | 'sales.write'
  | 'sales.reverse'
  | 'customers.read'
  | 'customers.write'
  | 'suppliers.read'
  | 'suppliers.write'
  | 'purchases.read'
  | 'purchases.write'
  | 'expenses.read'
  | 'expenses.write'
  | 'expenses.reverse'
  | 'dailyClosing.read'
  | 'dailyClosing.write'
  | 'dailyClosing.reverse'
  | 'reports.read'
  | 'settings.read'
  | 'settings.write'
  | 'users.read'
  | 'users.write'
  | 'backup.read'
  | 'backup.write';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: [
    'products.read',
    'products.create',
    'products.update',
    'products.delete',
    'inventory.read',
    'inventory.write',
    'inventory.delete',
    'sales.read',
    'sales.write',
    'sales.reverse',
    'customers.read',
    'customers.write',
    'suppliers.read',
    'suppliers.write',
    'purchases.read',
    'purchases.write',
    'expenses.read',
    'expenses.write',
    'expenses.reverse',
    'dailyClosing.read',
    'dailyClosing.write',
    'dailyClosing.reverse',
    'reports.read',
    'settings.read',
    'settings.write',
    'users.read',
    'users.write',
    'backup.read',
    'backup.write',
  ],
  MANAGER: [
    'products.read',
    'products.create',
    'products.update',
    'inventory.read',
    'inventory.write',
    'sales.read',
    'sales.write',
    'sales.reverse',
    'customers.read',
    'customers.write',
    'suppliers.read',
    'suppliers.write',
    'purchases.read',
    'purchases.write',
    'expenses.read',
    'expenses.write',
    'expenses.reverse',
    'dailyClosing.read',
    'dailyClosing.write',
    'dailyClosing.reverse',
    'reports.read',
    'settings.read',
    'settings.write',
    'backup.read',
    'backup.write',
  ],
  STAFF: [
    'products.read',
    'inventory.read',
    'sales.read',
    'sales.write',
    'customers.read',
    'customers.write',
    'dailyClosing.read',
    'dailyClosing.write',
  ],
  VIEW_ONLY: [
    'products.read',
    'inventory.read',
    'sales.read',
    'customers.read',
    'suppliers.read',
    'purchases.read',
    'expenses.read',
    'dailyClosing.read',
    'reports.read',
    'settings.read',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  return perms ? perms.includes(permission) : false;
}

export function requirePermission(role: Role, permission: Permission) {
  if (!hasPermission(role, permission)) {
    throw new Error(`Forbidden: Role ${role} does not have required permission: ${permission}`);
  }
}
