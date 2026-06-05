import 'server-only';

import { createHash, randomBytes } from 'crypto';

import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export const TENANT_API_KEY_SCOPES = ['bookings:create', 'bookings:read'] as const;

export type TenantApiKeyScope = (typeof TENANT_API_KEY_SCOPES)[number];

export type TenantApiKeyDto = {
  id: string;
  keyPrefix: string;
  name: string;
  scopes: TenantApiKeyScope[];
  status: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatedTenantApiKeyResult = {
  key: TenantApiKeyDto;
  plaintextKey: string;
};

type TenantApiKeyRow = {
  id: string;
  key_prefix: string;
  name: string;
  scopes: unknown;
  status: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

const KEY_NAME_MAX_LENGTH = 80;
const BASE64URL_PADDING_PATTERN = /=/g;

function toBase64Url(bytes: Buffer) {
  return bytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(BASE64URL_PADDING_PATTERN, '');
}

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function generateRawKey() {
  const keyPrefix = toBase64Url(randomBytes(9)).slice(0, 12);
  const secret = toBase64Url(randomBytes(32));
  const plaintextKey = `ak_live_${keyPrefix}_${secret}`;

  return {
    keyPrefix,
    plaintextKey,
    keyHash: sha256Hex(plaintextKey),
  };
}

function normalizeName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('API key name is required.');
  }

  return trimmed.slice(0, KEY_NAME_MAX_LENGTH);
}

export function normalizeTenantApiKeyScopes(scopes: unknown): TenantApiKeyScope[] {
  if (!Array.isArray(scopes)) return [];

  const uniqueScopes = new Set<TenantApiKeyScope>();
  for (const scope of scopes) {
    if (TENANT_API_KEY_SCOPES.includes(scope as TenantApiKeyScope)) {
      uniqueScopes.add(scope as TenantApiKeyScope);
    }
  }

  return Array.from(uniqueScopes);
}

function requireScopes(scopes: unknown) {
  const normalizedScopes = normalizeTenantApiKeyScopes(scopes);
  if (normalizedScopes.length === 0) {
    throw new Error('Select at least one valid API key scope.');
  }

  return normalizedScopes;
}

function toDto(row: TenantApiKeyRow): TenantApiKeyDto {
  return {
    id: row.id,
    keyPrefix: row.key_prefix,
    name: row.name,
    scopes: normalizeTenantApiKeyScopes(row.scopes),
    status: row.status,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function recordTenantApiKeyEvent(
  eventType: 'created' | 'revoked' | 'rotated',
  details: {
    tenantId: string;
    apiKeyId: string;
    keyPrefix: string;
    actorId: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    const { error } = await getSupabaseAdminClient().from('tenant_api_key_events').insert({
      tenant_id: details.tenantId,
      api_key_id: details.apiKeyId,
      key_prefix: details.keyPrefix,
      event_type: eventType,
      actor_id: details.actorId,
      metadata: details.metadata ?? {},
    });

    if (error) {
      console.warn('[tenant-api-keys] event write failed', {
        eventType,
        apiKeyId: details.apiKeyId,
        code: error.code,
      });
    }
  } catch (error) {
    console.warn('[tenant-api-keys] event write threw', {
      eventType,
      apiKeyId: details.apiKeyId,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function listTenantApiKeys(tenantId: string): Promise<TenantApiKeyDto[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from('tenant_api_keys')
    .select('id, key_prefix, name, scopes, status, expires_at, revoked_at, last_used_at, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .returns<TenantApiKeyRow[]>();

  if (error) {
    throw new Error('Failed to list API keys.');
  }

  return (data ?? []).map(toDto);
}

export async function createTenantApiKey(input: {
  tenantId: string;
  name: string;
  scopes: unknown;
  actorId?: string | null;
  expiresAt?: string | null;
}): Promise<CreatedTenantApiKeyResult> {
  const name = normalizeName(input.name);
  const scopes = requireScopes(input.scopes);
  const { keyPrefix, plaintextKey, keyHash } = generateRawKey();

  const { data, error } = await getSupabaseAdminClient()
    .from('tenant_api_keys')
    .insert({
      tenant_id: input.tenantId,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name,
      scopes,
      status: 'active',
      expires_at: input.expiresAt ?? null,
      created_by: input.actorId ?? null,
    })
    .select('id, key_prefix, name, scopes, status, expires_at, revoked_at, last_used_at, created_at, updated_at')
    .single<TenantApiKeyRow>();

  if (error || !data) {
    throw new Error('Failed to create API key.');
  }

  await recordTenantApiKeyEvent('created', {
    tenantId: input.tenantId,
    apiKeyId: data.id,
    keyPrefix,
    actorId: input.actorId ?? null,
    metadata: { scopes, name },
  });

  return {
    key: toDto(data),
    plaintextKey,
  };
}

export async function revokeTenantApiKey(input: {
  tenantId: string;
  apiKeyId: string;
  actorId?: string | null;
}): Promise<TenantApiKeyDto> {
  const now = new Date().toISOString();

  const { data, error } = await getSupabaseAdminClient()
    .from('tenant_api_keys')
    .update({
      status: 'revoked',
      revoked_at: now,
      revoked_by: input.actorId ?? null,
    })
    .eq('id', input.apiKeyId)
    .eq('tenant_id', input.tenantId)
    .select('id, key_prefix, name, scopes, status, expires_at, revoked_at, last_used_at, created_at, updated_at')
    .maybeSingle<TenantApiKeyRow>();

  if (error || !data) {
    throw new Error('Failed to revoke API key.');
  }

  await recordTenantApiKeyEvent('revoked', {
    tenantId: input.tenantId,
    apiKeyId: data.id,
    keyPrefix: data.key_prefix,
    actorId: input.actorId ?? null,
    metadata: { revokedAt: now },
  });

  return toDto(data);
}

export async function regenerateTenantApiKey(input: {
  tenantId: string;
  apiKeyId: string;
  actorId?: string | null;
}): Promise<CreatedTenantApiKeyResult> {
  const { data: existingKey, error: existingKeyError } = await getSupabaseAdminClient()
    .from('tenant_api_keys')
    .select('id, key_prefix, name, scopes, status, expires_at, revoked_at, last_used_at, created_at, updated_at')
    .eq('id', input.apiKeyId)
    .eq('tenant_id', input.tenantId)
    .maybeSingle<TenantApiKeyRow>();

  if (existingKeyError || !existingKey) {
    throw new Error('API key not found.');
  }

  if (existingKey.status === 'revoked' || existingKey.revoked_at) {
    throw new Error('Revoked API keys cannot be regenerated.');
  }

  const created = await createTenantApiKey({
    tenantId: input.tenantId,
    name: `${existingKey.name} rotated`,
    scopes: normalizeTenantApiKeyScopes(existingKey.scopes),
    actorId: input.actorId ?? null,
    expiresAt: existingKey.expires_at,
  });

  try {
    await revokeTenantApiKey({
      tenantId: input.tenantId,
      apiKeyId: existingKey.id,
      actorId: input.actorId ?? null,
    });
  } catch (error) {
    await revokeTenantApiKey({
      tenantId: input.tenantId,
      apiKeyId: created.key.id,
      actorId: input.actorId ?? null,
    });

    throw error;
  }

  await recordTenantApiKeyEvent('rotated', {
    tenantId: input.tenantId,
    apiKeyId: created.key.id,
    keyPrefix: created.key.keyPrefix,
    actorId: input.actorId ?? null,
    metadata: {
      previousApiKeyId: existingKey.id,
      previousKeyPrefix: existingKey.key_prefix,
    },
  });

  return created;
}
