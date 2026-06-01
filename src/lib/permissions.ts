import { getActiveTenant } from './tenant';

export interface UserPermissions {
  isOwner: boolean;
  role: 'admin' | 'staff' | 'doctor';
  canViewRevenue: boolean;
  canViewAllBookings: boolean;
  canManageAI: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
}

/**
 * Safely fetches and resolves user roles and permissions.
 * Supports both Server and Client Supabase clients by accepting the supabase instance as an argument.
 * 
 * @param supabase The Supabase client instance (server-side or client-side)
 * @param sessionUser The authenticated user object from the active session
 */
export async function getUserPermissions(
  supabase: any,
  sessionUser: any
): Promise<UserPermissions | null> {
  if (!sessionUser) return null;

  // 1. Get active tenant using the unified race-condition-resistant method
  const tenant = await getActiveTenant(sessionUser);
  if (!tenant) return null;

  // 2. Owner Check: If user is the primary workspace owner, grant absolute permissions
  if (tenant.user_id === sessionUser.id) {
    return {
      isOwner: true,
      role: 'admin',
      canViewRevenue: true,
      canViewAllBookings: true,
      canManageAI: true,
      canManageUsers: true,
      canManageSettings: true
    };
  }

  // 3. Employee Check: Fetch profile from public.profiles database
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, permissions')
    .eq('id', sessionUser.id)
    .maybeSingle();

  if (error || !profile) {
    // Default fallback if no profile exists in database
    return {
      isOwner: false,
      role: 'staff',
      canViewRevenue: false,
      canViewAllBookings: false,
      canManageAI: false,
      canManageUsers: false,
      canManageSettings: false
    };
  }

  const role = (profile.role || 'staff') as 'admin' | 'staff' | 'doctor';
  const permissions = profile.permissions || {};
  const isAdmin = role === 'admin';

  return {
    isOwner: false,
    role,
    // Owners/Admins or employees with view_revenue permission can view financial data
    canViewRevenue: isAdmin || !!permissions.view_revenue,
    // Owners/Admins or employees with view_all_bookings permission can see all bookings
    canViewAllBookings: isAdmin || !!permissions.view_all_bookings,
    // Owners/Admins or employees with manage_settings permission can manage AI automations
    canManageAI: isAdmin || !!permissions.manage_settings,
    // User management (/users) is strictly restricted to Owners and Admin profiles
    canManageUsers: isAdmin,
    // Workspace Settings (/settings) is strictly restricted to Owners and Admin profiles
    canManageSettings: isAdmin
  };
}

/**
 * Direct helper function to check if a user has a specific permission.
 * 
 * @param supabase The Supabase client instance
 * @param sessionUser The authenticated user object
 * @param permissionKey The specific permission field to verify
 */
export async function hasPermission(
  supabase: any,
  sessionUser: any,
  permissionKey: keyof Omit<UserPermissions, 'isOwner' | 'role'>
): Promise<boolean> {
  const perms = await getUserPermissions(supabase, sessionUser);
  if (!perms) return false;
  return perms[permissionKey];
}
