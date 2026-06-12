import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const currentFingerprint = crypto.createHash('sha256').update(userAgent).digest('hex');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid Token' }, { status: 401 });
    }

    // Session fingerprinting: detect session hijacking by comparing User-Agent hash
    const storedFingerprint = user.user_metadata?.fingerprint as string | undefined;
    if (storedFingerprint && storedFingerprint !== currentFingerprint) {
      console.error(`[SECURITY] Session hijack detected for user ${user.id}. Fingerprint mismatch.`);
      return NextResponse.json({ error: 'Session Hijacked: Unauthorized Device' }, { status: 401 });
    }

    const url = new URL(req.url);
    const tenantId = url.searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ error: 'Tenant ID missing' }, { status: 400 });

    // BOLA: verify authenticated user owns the requested tenant
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tenantRow) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Ledger integrity: recompute balance from raw entries and compare to materialized view
    const { data: ledgerEntries, error: ledgerError } = await supabase
      .from('wallet_ledger')
      .select('credit, debit, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (ledgerError) throw ledgerError;

    let computedBalance = 0;
    const hashStream = crypto.createHash('sha256');

    ledgerEntries?.forEach(entry => {
      computedBalance += (Number(entry.credit) - Number(entry.debit));
      hashStream.update(`${entry.credit}:${entry.debit}:${entry.created_at}`);
    });

    const ledgerHash = hashStream.digest('hex');

    const { data: viewData } = await supabase
      .from('wallet_balances')
      .select('current_balance')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const displayedBalance = viewData?.current_balance ?? 0;

    if (Math.abs(computedBalance - displayedBalance) > 0.01) {
      console.error(`[CRITICAL] DB Tampering Detected for tenant ${tenantId}! Raw: ${computedBalance}, View: ${displayedBalance}`);
      return NextResponse.json({
        error: 'Data Integrity Compromised. Wallet frozen.',
        code: 'LEDGER_TAMPERED'
      }, { status: 423 });
    }

    return NextResponse.json({
      verifiedBalance: computedBalance,
      ledgerHash,
      integrity: 'VERIFIED_100',
      fingerprint: currentFingerprint
    });

  } catch (error) {
    console.error('BI verification error:', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json({ error: 'Unable to verify BI integrity.' }, { status: 500 });
  }
}
