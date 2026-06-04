import 'server-only';

import { createHash } from 'crypto';

import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export type ExternalApiScope = 'bookings:create' | 'bookings:read';

type TenantApiKeyStatus = 'active' | 'disabled' | 'revoked' | string | null;
type TenantStatus = string | null;

export type ExternalApiAuthResult =
  | {
      ok: true;
      tenantId: string;
      tenantStatus: TenantStatus;
      apiKeyId: string;
      keyPrefix: string;
      scopes: ExternalApiScope[];
      legacy: false;
    }
  | {
      ok: false;
      status: 401 | 403;
      reason: string;
    };

type TenantApiKeyRow = {
  id: string;
  tenant_id: string;
  key_prefix: string | null;
  scopes: unknown;
  status: TenantApiKeyStatus;
  expires_at: string | null;
  revoked_at: string | null;
};

type TenantRow = {
  id: string;
  status: TenantStatus;
};

const MAX_BEARER_TOKEN_LENGTH = 2048;
const CONTROL_CHARACTER_PATTERN = /[\x00-\x1F\x7F]/;

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function parseBearerToken(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { ok: false as const, reason: 'missing_authorization' };
  }

  if (CONTROL_CHARACTER_PATTERN.test(authHeader)) {
    return { ok: false as const, reason: 'malformed_authorization' };
  }

  const match = /^Bearer ([^\s]+)$/i.exec(authHeader);
  if (!match) {
    return { ok: false as const, reason: 'malformed_authorization' };
  }

  const token = match[1];
  if (!token || token.length > MAX_BEARER_TOKEN_LENGTH || CONTROL_CHARACTER_PATTERN.test(token)) {
    return { ok: false as const, reason: 'malformed_authorization' };
  }

  return { ok: true as const, token };
}

function normalizeScopes(value: unknown): ExternalApiScope[] {
  if (!Array.isArray(value)) return [];

  return value.filter((scope): scope is ExternalApiScope =>
    scope === 'bookings:create' || scope === 'bookings:read'
  );
}

function getClientIp(req: Request) {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const firstForwardedIp = forwardedFor?.split(',')[0]?.trim();
  return firstForwardedIp || req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip');
}

function hashNullableHeader(value: string | null) {
  if (!value) return null;
  return sha256Hex(value);
}

async function recordApiKeyEvent(
  eventType: 'used' | 'failed_auth',
  details: {
    tenantId: string | null;
    apiKeyId: string | null;
    keyPrefix: string;
  }
) {
  const { error } = await getSupabaseAdminClient().from('tenant_api_key_events').insert({
    event_type: eventType,
    tenant_id: details.tenantId,
    api_key_id: details.apiKeyId,
    key_prefix: details.keyPrefix,
  });

  if (error) {
    console.warn('[external-api-auth] API key event write failed', {
      eventType,
      code: error.code,
    });
  }
}

async function recordFailedAuth(keyPrefix: string) {
  try {
    await recordApiKeyEvent('failed_auth', {
      tenantId: null,
      apiKeyId: null,
      keyPrefix,
    });
  } catch (error) {
    console.warn('[external-api-auth] Failed auth audit write threw', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function recordSuccessfulAuth(req: Request, key: TenantApiKeyRow) {
  const keyPrefix = key.key_prefix ?? 'unknown';

  try {
    await recordApiKeyEvent('used', {
      tenantId: key.tenant_id,
      apiKeyId: key.id,
      keyPrefix,
    });
  } catch (error) {
    console.warn('[external-api-auth] Successful auth audit write threw', {
      apiKeyId: key.id,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  try {
    const { error } = await getSupabaseAdminClient()
      .from('tenant_api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        last_used_ip_hash: hashNullableHeader(getClientIp(req)),
        last_used_user_agent_hash: hashNullableHeader(req.headers.get('user-agent')),
      })
      .eq('id', key.id);

    if (error) {
      console.warn('[external-api-auth] API key last-used update failed', {
        apiKeyId: key.id,
        code: error.code,
      });
    }
  } catch (error) {
    console.warn('[external-api-auth] API key last-used update threw', {
      apiKeyId: key.id,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function authenticateExternalApiRequest(
  req: Request,
  requiredScope: ExternalApiScope
): Promise<ExternalApiAuthResult> {
  const parsed = parseBearerToken(req);
  if (!parsed.ok) {
    await recordFailedAuth('unknown');
    return { ok: false, status: 401, reason: parsed.reason };
  }

  const keyHash = sha256Hex(parsed.token);
  const hashPrefix = keyHash.slice(0, 12);
  const supabase = getSupabaseAdminClient();

  const { data: apiKey, error: apiKeyError } = await supabase
    .from('tenant_api_keys')
    .select('id, tenant_id, key_prefix, scopes, status, expires_at, revoked_at')
    .eq('key_hash', keyHash)
    .maybeSingle<TenantApiKeyRow>();

  if (apiKeyError || !apiKey) {
    await recordFailedAuth(hashPrefix);
    return { ok: false, status: 401, reason: 'invalid_api_key' };
  }

  const scopes = normalizeScopes(apiKey.scopes);
  const expiresAt = apiKey.expires_at ? new Date(apiKey.expires_at) : null;

  if (
    apiKey.status !== 'active' ||
    apiKey.revoked_at !== null ||
    (expiresAt !== null && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()))
  ) {
    await recordFailedAuth(apiKey.key_prefix ?? hashPrefix);
    return { ok: false, status: 403, reason: 'api_key_not_active' };
  }

  if (!scopes.includes(requiredScope)) {
    await recordFailedAuth(apiKey.key_prefix ?? hashPrefix);
    return { ok: false, status: 403, reason: 'missing_scope' };
  }

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, status')
    .eq('id', apiKey.tenant_id)
    .maybeSingle<TenantRow>();

  if (tenantError || !tenant || tenant.id !== apiKey.tenant_id) {
    await recordFailedAuth(apiKey.key_prefix ?? hashPrefix);
    return { ok: false, status: 403, reason: 'tenant_not_found' };
  }

  if (tenant.status === 'suspended' || tenant.status === 'inactive') {
    await recordFailedAuth(apiKey.key_prefix ?? hashPrefix);
    return { ok: false, status: 403, reason: 'tenant_not_active' };
  }

  await recordSuccessfulAuth(req, apiKey);

  return {
    ok: true,
    tenantId: tenant.id,
    tenantStatus: tenant.status,
    apiKeyId: apiKey.id,
    keyPrefix: apiKey.key_prefix ?? 'unknown',
    scopes,
    legacy: false,
  };
}
