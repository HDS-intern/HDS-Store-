import type { User } from './types'

export type PermissionKey =
  | 'dashboard'
  | 'inventory_view'
  | 'inventory_manage'
  | 'orders_view'
  | 'orders_manage'
  | 'payments_view'
  | 'payments_manage'
  | 'staff_records'
  | 'users_manage'

export type UserPermissions = Record<PermissionKey, boolean>

export const PERMISSION_META: {
  key: PermissionKey
  label: string
  description: string
}[] = [
  { key: 'dashboard', label: 'Dashboard', description: 'View sales graphs and attendance' },
  { key: 'inventory_view', label: 'View Inventory', description: 'Browse product listings' },
  { key: 'inventory_manage', label: 'Manage Inventory', description: 'Add, edit, and delete products' },
  { key: 'orders_view', label: 'View Orders', description: 'See customer orders' },
  { key: 'orders_manage', label: 'Manage Orders', description: 'Update order status and tracking' },
  { key: 'payments_view', label: 'View Payments', description: 'See payment records' },
  { key: 'payments_manage', label: 'Manage Payments', description: 'Authorize and update payments' },
  { key: 'staff_records', label: 'Staff Records', description: 'Access HR and employee data' },
  { key: 'users_manage', label: 'System Users', description: 'Create, edit, delete users and set permissions' },
]

export const ALL_PERMISSION_KEYS = PERMISSION_META.map((p) => p.key)

export function defaultStaffPermissions(): UserPermissions {
  return {
    dashboard: true,
    inventory_view: true,
    inventory_manage: true,
    orders_view: true,
    orders_manage: true,
    payments_view: true,
    payments_manage: false,
    staff_records: false,
    users_manage: false,
  }
}

export function fullPermissions(): UserPermissions {
  return Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, true])) as UserPermissions
}

export function permissionsForRole(role: 'staff' | 'admin'): UserPermissions {
  return role === 'admin' ? fullPermissions() : defaultStaffPermissions()
}

export function parsePermissions(
  raw: string | null | undefined,
  role: User['role']
): UserPermissions | undefined {
  if (role === 'customer') return undefined
  if (role === 'admin') return fullPermissions()
  if (!raw) return defaultStaffPermissions()
  try {
    const parsed = JSON.parse(raw) as Partial<UserPermissions>
    const base = defaultStaffPermissions()
    for (const key of ALL_PERMISSION_KEYS) {
      if (typeof parsed[key] === 'boolean') base[key] = parsed[key]!
    }
    return base
  } catch {
    return defaultStaffPermissions()
  }
}

export function hasPermission(user: User, key: PermissionKey): boolean {
  if (user.role === 'admin') return true
  if (user.role !== 'staff') return false
  const perms = user.permissions ?? defaultStaffPermissions()
  return perms[key] === true
}

export function countEnabledPermissions(perms: UserPermissions): number {
  return ALL_PERMISSION_KEYS.filter((k) => perms[k]).length
}
