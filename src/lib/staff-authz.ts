import 'server-only';

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { isPrivilegedStaffRole } from '@/lib/staff-roles';

export type TenantRecord = {
  id: string;
  user_id: string;
};

export type TargetProfile = {
  id: string;
  tenant_id: string | null;
  role: string | null;
};

const sanitize = (value: string | undefined) =>
  (value ?? '').replace(/[^\x20-\x7E]/g, '').trim();

export function getRequestBearerToken(req: Request, bodyToken: unknown) {
  if (typeof bodyToken === 'string' && bodyToken.trim()) {
    return bodyToken.trim();
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
}

export function createStaffUserClient(token: string) {
  const supabaseUrl = sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = sanitize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase user client is not configured.');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

export async function getAuthenticatedStaffRequester(supabaseUserClient: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabaseUserClient.auth.getUser();

  return { user, error };
}

export async function getTenantOwnerAccess(
  supabaseUserClient: SupabaseClient,
  tenantId: string,
  requester: User
): Promise<
  | { ok: true; tenant: TenantRecord; isTenantOwner: true }
  | { ok: false; status: 403; error: string }
> {
  const { data, error } = await supabaseUserClient
    .from('tenants')
    .select('id, user_id')
    .eq('id', tenantId)
    .single();

  const tenant = data as TenantRecord | null;

  if (error || !tenant) {
    return { ok: false, status: 403, error: 'Forbidden: tenant administration access required.' };
  }

  if (tenant.user_id !== requester.id) {
    return { ok: false, status: 403, error: 'Forbidden: only the primary tenant owner can manage staff.' };
  }

  return { ok: true, tenant, isTenantOwner: true };
}

export function isProtectedStaffTarget(targetProfile: TargetProfile, tenant: TenantRecord) {
  return targetProfile.id === tenant.user_id || isPrivilegedStaffRole(targetProfile.role);
}

export function hasProtectedAuthAppRole(authUser: { app_metadata?: Record<string, unknown> } | null | undefined) {
  return isPrivilegedStaffRole(authUser?.app_metadata?.role);
}
