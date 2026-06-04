import 'server-only';

import crypto from 'crypto';

const TOKEN_PREFIX = 'pct_v1';
const DEFAULT_TOKEN_TTL_SECONDS = 10 * 60;
const MAX_TOKEN_TTL_SECONDS = 10 * 60;
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublicChatTokenPayload = {
  tenantId: string;
  host: string;
  exp: number;
  iat: number;
};

export type PublicChatTokenVerification =
  | { ok: true; payload: PublicChatTokenPayload }
  | { ok: false; reason: 'missing_secret' | 'malformed' | 'invalid_signature' | 'expired' | 'tenant_mismatch' | 'host_mismatch' };

export function normalizePublicChatHost(value: string | null | undefined) {
  const firstValue = value?.split(',')[0]?.trim();
  if (!firstValue) return null;

  if (firstValue === '::1') return '::1';

  try {
    const parsed = new URL(firstValue.includes('://') ? firstValue : `http://${firstValue}`);
    return parsed.hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1').replace(/\.$/, '');
  } catch {
    return null;
  }
}

export function isLocalPublicChatHost(host: string | null) {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export function isValidPublicChatTenantId(value: string | null | undefined) {
  return typeof value === 'string' && uuidRegex.test(value);
}

export function getTrustedPublicChatRequestHost(headers: Headers) {
  const forwardedHost = normalizePublicChatHost(headers.get('x-forwarded-host'));
  const host = normalizePublicChatHost(headers.get('host'));

  if (forwardedHost && host && forwardedHost !== host) {
    return null;
  }

  return forwardedHost || host;
}

export function getPublicChatSigningSecret() {
  return process.env.PUBLIC_CHAT_TOKEN_SECRET?.trim() || null;
}

export function createPublicChatToken({
  tenantId,
  host,
  ttlSeconds = DEFAULT_TOKEN_TTL_SECONDS,
}: {
  tenantId: string;
  host: string;
  ttlSeconds?: number;
}) {
  const secret = getPublicChatSigningSecret();
  if (!secret) {
    throw new Error('PUBLIC_CHAT_TOKEN_SECRET is required to sign public chat tokens.');
  }

  if (!isValidPublicChatTenantId(tenantId)) {
    throw new Error('A valid tenantId is required to sign public chat tokens.');
  }

  const normalizedHost = normalizePublicChatHost(host);
  if (!normalizedHost) {
    throw new Error('A valid host is required to sign public chat tokens.');
  }

  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error('A positive ttlSeconds value is required to sign public chat tokens.');
  }

  const effectiveTtlSeconds = Math.min(Math.floor(ttlSeconds), MAX_TOKEN_TTL_SECONDS);
  const now = Math.floor(Date.now() / 1000);
  const payload: PublicChatTokenPayload = {
    tenantId,
    host: normalizedHost,
    iat: now,
    exp: now + effectiveTtlSeconds,
  };
  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(payload), 'utf8'));
  const signedValue = `${TOKEN_PREFIX}.${encodedPayload}`;
  const signature = sign(signedValue, secret);

  return `${signedValue}.${signature}`;
}

export function verifyPublicChatToken({
  token,
  tenantId,
  host,
}: {
  token: string | null | undefined;
  tenantId: string;
  host: string;
}): PublicChatTokenVerification {
  const secret = getPublicChatSigningSecret();
  if (!secret) return { ok: false, reason: 'missing_secret' };

  const parts = token?.split('.');
  if (!parts || parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
    return { ok: false, reason: 'malformed' };
  }

  const signedValue = `${parts[0]}.${parts[1]}`;
  const expectedSignature = sign(signedValue, secret);
  if (!timingSafeSignatureEqual(parts[2], expectedSignature)) {
    return { ok: false, reason: 'invalid_signature' };
  }

  const payload = parsePayload(parts[1]);
  if (!payload) return { ok: false, reason: 'malformed' };

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) return { ok: false, reason: 'expired' };
  if (payload.tenantId !== tenantId) return { ok: false, reason: 'tenant_mismatch' };

  const normalizedHost = normalizePublicChatHost(host);
  if (!normalizedHost || payload.host !== normalizedHost) {
    return { ok: false, reason: 'host_mismatch' };
  }

  return { ok: true, payload };
}

function parsePayload(value: string): PublicChatTokenPayload | null {
  try {
    const parsed = JSON.parse(base64UrlDecode(value).toString('utf8'));
    if (
      !parsed ||
      typeof parsed.tenantId !== 'string' ||
      typeof parsed.host !== 'string' ||
      typeof parsed.exp !== 'number' ||
      typeof parsed.iat !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function sign(value: string, secret: string) {
  return base64UrlEncode(crypto.createHmac('sha256', secret).update(value).digest());
}

function timingSafeSignatureEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function base64UrlEncode(value: Buffer) {
  return value.toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url');
}
