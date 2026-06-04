export const SAFE_TENANT_STAFF_ROLES = ['staff', 'doctor', 'secretary', 'manager'] as const;
export const TENANT_OWNER_ASSIGNABLE_ADMIN_ROLES = ['admin'] as const;

export const PRIVILEGED_PLATFORM_ROLES = [
  'master_admin',
  'super_admin',
  'agency_admin',
  'platform_admin',
  'owner',
  'billing_admin',
  'system_admin',
] as const;

export const SAFE_STAFF_PERMISSION_KEYS = [
  'bookings',
  'services',
  'customers',
  'messages',
  'automations',
  'marketing',
  'team',
  'branches',
  'financial',
  'billing',
  'view_all_bookings',
] as const;

export type SafeTenantStaffRole = (typeof SAFE_TENANT_STAFF_ROLES)[number];
export type TenantOwnerAssignableAdminRole = (typeof TENANT_OWNER_ASSIGNABLE_ADMIN_ROLES)[number];
export type StaffRole = SafeTenantStaffRole | TenantOwnerAssignableAdminRole;
export type StaffPermissions = Record<(typeof SAFE_STAFF_PERMISSION_KEYS)[number], boolean>;

const safeStaffRoleSet = new Set<string>(SAFE_TENANT_STAFF_ROLES);
const tenantAdminRoleSet = new Set<string>(TENANT_OWNER_ASSIGNABLE_ADMIN_ROLES);
const privilegedRoleSet = new Set<string>(PRIVILEGED_PLATFORM_ROLES);
const permissionKeySet = new Set<string>(SAFE_STAFF_PERMISSION_KEYS);

export function normalizeStaffRole(role: unknown) {
  return typeof role === 'string' ? role.trim().toLowerCase() : '';
}

export function isPrivilegedStaffRole(role: unknown) {
  return privilegedRoleSet.has(normalizeStaffRole(role));
}

export function validateAssignableStaffRole(
  role: unknown,
  options: { allowTenantAdmin: boolean }
): { ok: true; role: StaffRole } | { ok: false; status: 400 | 403; error: string } {
  const normalizedRole = normalizeStaffRole(role);

  if (!normalizedRole) {
    return { ok: false, status: 400, error: 'Invalid staff role.' };
  }

  if (privilegedRoleSet.has(normalizedRole)) {
    return { ok: false, status: 403, error: 'Forbidden staff role.' };
  }

  if (safeStaffRoleSet.has(normalizedRole)) {
    return { ok: true, role: normalizedRole as SafeTenantStaffRole };
  }

  if (tenantAdminRoleSet.has(normalizedRole)) {
    if (options.allowTenantAdmin) {
      return { ok: true, role: normalizedRole as TenantOwnerAssignableAdminRole };
    }

    return { ok: false, status: 403, error: 'Only the tenant owner can assign tenant admin role.' };
  }

  return { ok: false, status: 400, error: 'Unknown staff role.' };
}

export function sanitizeStaffPermissions(
  permissions: unknown
): { ok: true; permissions: Partial<StaffPermissions> } | { ok: false; error: string } {
  if (permissions === undefined || permissions === null) {
    return { ok: true, permissions: {} };
  }

  if (typeof permissions !== 'object' || Array.isArray(permissions)) {
    return { ok: false, error: 'Invalid permissions shape.' };
  }

  const sanitized: Partial<StaffPermissions> = {};

  for (const [key, value] of Object.entries(permissions)) {
    if (!permissionKeySet.has(key)) {
      return { ok: false, error: 'Unsupported permission key.' };
    }

    if (typeof value !== 'boolean') {
      return { ok: false, error: 'Permission values must be booleans.' };
    }

    sanitized[key as keyof StaffPermissions] = value;
  }

  return { ok: true, permissions: sanitized };
}
