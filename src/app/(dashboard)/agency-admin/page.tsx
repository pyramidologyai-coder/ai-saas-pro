import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { AgencyDashboardUI } from '@/components/agency-admin/AgencyDashboardUI';
import UpgradeButton from './UpgradeButton';
import { TenantCrypto } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

export default async function AgencyDashboardPage() {
  // 1. Authenticate user securely on the server via cookies
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  // 2. Retrieve Agency profile matching authenticated user ID
  const { data: agencyData, error } = await supabase
    .from('agencies')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // If user is not registered as an agency, display upgrade promotion screen
  if (error || !agencyData) {
    return (
      <div style={{ padding: '5rem 2rem', textAlign: 'center', color: 'var(--text-main)', direction: 'rtl' }}>
        <ShieldCheck size={64} color="#f59e0b" style={{ margin: '0 auto 1rem auto' }} />
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem', fontWeight: '850' }}>لوحة الوكالات (Agency Reseller)</h1>
        <p style={{ color: 'var(--text-dim)', marginBottom: '2rem', fontSize: '1.05rem' }}>
          أنت غير مسجل كصاحب وكالة. هل تريد ترقية حسابك لتبدأ في بيع النظام بالعمولة باسمك (White-label)؟
        </p>
        <UpgradeButton />
      </div>
    );
  }

  // If agency subscription is inactive, display payment lock screen
  if (agencyData.subscription_status !== 'active') {
    return (
      <div style={{ padding: '5rem 2rem', textAlign: 'center', color: 'var(--text-main)', direction: 'rtl' }}>
        <ShieldCheck size={64} color="#ef4444" style={{ margin: '0 auto 1rem auto' }} />
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem', fontWeight: '850' }}>حساب الوكالة غير مفعل</h1>
        <p style={{ color: 'var(--text-dim)', marginBottom: '2rem', fontSize: '1.05rem' }}>
          حساب الوكالة الخاص بك مسجل لدينا ولكنه بانتظار إتمام الدفع (أو تم إيقافه). لا يمكنك إضافة عملاء حالياً.
        </p>
        <button style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '0.8rem 2rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
          استكمال الدفع الآن
        </button>
      </div>
    );
  }

  // 3. Fetch Agency's clinic/restaurant tenants
  const { data: tenantsData } = await supabase
    .from('tenants')
    .select('*')
    .eq('agency_id', agencyData.id);

  const tenantsList = tenantsData || [];
  const tenantIds = tenantsList.map((t: any) => t.id);

  // 4. Fetch and aggregate AI message usages
  let messagesData: any[] = [];
  if (tenantIds.length > 0) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('tenant_id, sender')
      .in('tenant_id', tenantIds);
    messagesData = msgs || [];
  }

  let totalUsage = 0;
  const tenantsWithUsage = tenantsList.map((t: any) => {
    const usage = messagesData.filter((m: any) => m.tenant_id === t.id && m.sender === 'model').length || 0;
    totalUsage += usage;
    return { ...t, ai_usage: usage };
  });

  // 5. Decrypt Paymob API Key securely on the server using TenantCrypto
  let paymobApiKeyDecrypted = '';
  if (agencyData.paymob_api_key_encrypted) {
    try {
      paymobApiKeyDecrypted = await TenantCrypto.decrypt(agencyData.paymob_api_key_encrypted, agencyData.id);
    } catch (err) {
      console.error('Failed to decrypt Paymob API Key on the server:', err);
    }
  }

  // 6. Generate masked keys for secure rendering to prevent sensitive data leaks
  const stripeAccountIdMasked = agencyData.stripe_account_id
    ? `${agencyData.stripe_account_id.substring(0, 8)}••••••••`
    : '';

  const paymobApiKeyMasked = paymobApiKeyDecrypted
    ? `••••••••${paymobApiKeyDecrypted.substring(Math.max(0, paymobApiKeyDecrypted.length - 4))}`
    : '';

  const stats = {
    totalTenants: tenantsList.length,
    totalAiUsage: totalUsage
  };

  return (
    <AgencyDashboardUI
      agency={agencyData}
      tenants={tenantsWithUsage}
      initialStats={stats}
      stripeAccountIdMasked={stripeAccountIdMasked}
      paymobApiKeyMasked={paymobApiKeyMasked}
    />
  );
}
