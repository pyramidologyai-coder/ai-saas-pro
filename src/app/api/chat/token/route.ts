export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  createPublicChatToken,
  getPublicChatSigningSecret,
  getTrustedPublicChatRequestHost,
  isValidPublicChatTenantId,
  normalizePublicChatHost,
} from '@/lib/public-chat-token';

const TOKEN_TTL_SECONDS = 10 * 60;

export async function GET(req: Request) {
  try {
    const requestHost = getTrustedPublicChatRequestHost(req.headers);
    if (!requestHost) {
      return NextResponse.json({ error: 'Forbidden: Untrusted request host.' }, { status: 403 });
    }

    if (!getPublicChatSigningSecret()) {
      return NextResponse.json({ error: 'Public chat token signing is not configured.' }, { status: 503 });
    }

    const appHost = normalizePublicChatHost(process.env.NEXT_PUBLIC_APP_URL);
    const supabaseAdmin = getSupabaseAdminClient();
    const url = new URL(req.url);

    let tenantQuery;
    if (appHost && requestHost === appHost) {
      const tenantId = url.searchParams.get('tenantId');
      if (!isValidPublicChatTenantId(tenantId)) {
        return NextResponse.json({ error: 'Valid Tenant ID is required' }, { status: 400 });
      }

      tenantQuery = supabaseAdmin
        .from('tenants')
        .select('id, status')
        .eq('id', tenantId)
        .single();
    } else {
      tenantQuery = supabaseAdmin
        .from('tenants')
        .select('id, status')
        .eq('custom_domain', requestHost)
        .single();
    }

    const { data: tenant } = await tenantQuery;
    if (!tenant || tenant.status !== 'active') {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const token = createPublicChatToken({
      tenantId: tenant.id,
      host: requestHost,
      ttlSeconds: TOKEN_TTL_SECONDS,
    });

    return NextResponse.json({
      token,
      tenantId: tenant.id,
      expiresIn: TOKEN_TTL_SECONDS,
      ttl: TOKEN_TTL_SECONDS,
    });
  } catch (error) {
    console.error('[PUBLIC CHAT TOKEN ERROR]:', error);
    return NextResponse.json({ error: 'Unable to issue public chat token.' }, { status: 500 });
  }
}
