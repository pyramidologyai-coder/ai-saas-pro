import { getActiveTenant } from './tenant';

export interface UserPermissions {
  isOwner: boolean;
  role: 'admin' | 'staff' | 'doctor' | 'secretary' | 'manager';
  
  // Custom functional logic
  canViewAllBookings: boolean;
  
  // Page-level permissions
  financial: boolean;
  services: boolean;
  bookings: boolean;
  customers: boolean;
  team: boolean;
  messages: boolean;
  automations: boolean;
  marketing: boolean;
  branches: boolean;
  billing: boolean;
}

// Client-only cache variables (Never modified or read on the server to prevent cross-user leakage)
let clientPermissionsPromise: Promise<UserPermissions | null> | null = null;
let clientCachedUserId: string | null = null;

export function clearPermissionsCache() {
  if (typeof window !== 'undefined') {
    clientPermissionsPromise = null;
    clientCachedUserId = null;
  }
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

  const isClient = typeof window !== 'undefined';

  // 1. If on server: bypass cache entirely and query directly for absolute data isolation (stateless)
  if (!isClient) {
    return fetchUserPermissionsFromDb(supabase, sessionUser);
  }

  // 2. If on client: securely use shared cache (exclusive to current user's browser context)
  if (clientCachedUserId !== sessionUser.id) {
    clearPermissionsCache();
    clientCachedUserId = sessionUser.id;
  }

  if (!clientPermissionsPromise) {
    clientPermissionsPromise = fetchUserPermissionsFromDb(supabase, sessionUser);
  }

  return clientPermissionsPromise;
}

/**
 * Core database query function for fetching user permissions.
 */
async function fetchUserPermissionsFromDb(
  supabase: any,
  sessionUser: any
): Promise<UserPermissions | null> {
  // 1. Get active tenant using the unified race-condition-resistant method
  const tenant = await getActiveTenant(sessionUser);
  if (!tenant) return null;

  // 2. Owner Check: If user is the primary workspace owner, grant absolute permissions
  if (tenant.user_id === sessionUser.id) {
    return {
      isOwner: true,
      role: 'admin',
      canViewAllBookings: true,
      financial: true,
      services: true,
      bookings: true,
      customers: true,
      team: true,
      messages: true,
      automations: true,
      marketing: true,
      branches: true,
      billing: true
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
      canViewAllBookings: false,
      financial: false,
      services: false,
      bookings: false,
      customers: false,
      team: false,
      messages: false,
      automations: false,
      marketing: false,
      branches: false,
      billing: false
    };
  }

  const role = (profile.role || 'staff') as 'admin' | 'staff' | 'doctor' | 'secretary' | 'manager';
  const permissions = profile.permissions || {};
  const isAdmin = role === 'admin';

  // 4. Admin Check: Admins get absolute permission clearance
  if (isAdmin) {
    return {
      isOwner: false,
      role,
      canViewAllBookings: true,
      financial: true,
      services: true,
      bookings: true,
      customers: true,
      team: true,
      messages: true,
      automations: true,
      marketing: true,
      branches: true,
      billing: true
    };
  }

  // 5. Employee Permissions Resolver with Double-Layer Fallbacks
  const isNewSchema = 'bookings' in permissions;

  return {
    isOwner: false,
    role,
    // view_all_bookings can be checked directly
    canViewAllBookings: !!permissions.view_all_bookings,

    // Granular page permissions
    financial: isNewSchema ? !!permissions.financial : !!permissions.view_revenue,
    billing: isNewSchema ? !!permissions.billing : !!permissions.view_revenue,
    automations: isNewSchema ? !!permissions.automations : !!permissions.manage_settings,

    // Fallbacks for standard pages (default to true for legacy employees)
    bookings: isNewSchema ? !!permissions.bookings : true,
    services: isNewSchema ? !!permissions.services : true,
    customers: isNewSchema ? !!permissions.customers : true,
    team: isNewSchema ? !!permissions.team : true,
    messages: isNewSchema ? !!permissions.messages : true,
    marketing: isNewSchema ? !!permissions.marketing : true,
    branches: isNewSchema ? !!permissions.branches : true,
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
