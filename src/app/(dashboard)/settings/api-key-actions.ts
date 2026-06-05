'use server';

import { createClient } from '@supabase/supabase-js';

import {
  createTenantApiKey,
  listTenantApiKeys,
  regenerateTenantApiKey,
  revokeTenantApiKey,
  TENANT_API_KEY_SCOPES,
  type TenantApiKeyScope,
} from '@/lib/tenant-api-keys';

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function getAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

async function getAuthenticatedUser(token: string) {
  const { data: { user }, error } = await getAuthClient().auth.getUser(token);
  if (error || !user) {
    throw new Error('Unauthorized');
  }

  return user;
}

async function assertCanManageTenant(token: string, tenantId: string) {
  const user = await getAuthenticatedUser(token);
  const supabase = getAuthClient();

  const { data: tenantAccess, error: tenantAccessError } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (tenantAccessError) {
    throw new Error('Authorization check failed.');
  }

  if (tenantAccess) {
    return user;
  }

  const { data: agencyAccess, error: agencyAccessError } = await supabase
    .from('tenants')
    .select('id, agency:agencies!inner(user_id)')
    .eq('id', tenantId)
    .eq('agencies.user_id', user.id)
    .maybeSingle();

  if (agencyAccessError) {
    throw new Error('Authorization check failed.');
  }

  if (!agencyAccess) {
    console.warn('[tenant-api-key-actions] BOLA blocked tenant API key management', {
      userId: user.id,
      tenantId,
    });
    throw new Error('You are not authorized to manage API keys for this tenant.');
  }

  return user;
}

function normalizeActionScopes(scopes: unknown): TenantApiKeyScope[] {
  if (!Array.isArray(scopes)) return [];

  const normalizedScopes = new Set<TenantApiKeyScope>();
  for (const scope of scopes) {
    if (TENANT_API_KEY_SCOPES.includes(scope as TenantApiKeyScope)) {
      normalizedScopes.add(scope as TenantApiKeyScope);
    }
  }

  return Array.from(normalizedScopes);
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'API key action failed.';
}

export async function listTenantApiKeysAction(
  token: string,
  tenantId: string
): Promise<ActionResult<Awaited<ReturnType<typeof listTenantApiKeys>>>> {
  try {
    await assertCanManageTenant(token, tenantId);
    const keys = await listTenantApiKeys(tenantId);
    return { success: true, data: keys };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function createTenantApiKeyAction(
  token: string,
  tenantId: string,
  input: { name: string; scopes: unknown }
): Promise<ActionResult<Awaited<ReturnType<typeof createTenantApiKey>>>> {
  try {
    const user = await assertCanManageTenant(token, tenantId);
    const result = await createTenantApiKey({
      tenantId,
      name: input.name,
      scopes: normalizeActionScopes(input.scopes),
      actorId: user.id,
    });

    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function revokeTenantApiKeyAction(
  token: string,
  tenantId: string,
  apiKeyId: string
): Promise<ActionResult<Awaited<ReturnType<typeof revokeTenantApiKey>>>> {
  try {
    const user = await assertCanManageTenant(token, tenantId);
    const key = await revokeTenantApiKey({
      tenantId,
      apiKeyId,
      actorId: user.id,
    });

    return { success: true, data: key };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function regenerateTenantApiKeyAction(
  token: string,
  tenantId: string,
  apiKeyId: string
): Promise<ActionResult<Awaited<ReturnType<typeof regenerateTenantApiKey>>>> {
  try {
    const user = await assertCanManageTenant(token, tenantId);
    const result = await regenerateTenantApiKey({
      tenantId,
      apiKeyId,
      actorId: user.id,
    });

    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}
