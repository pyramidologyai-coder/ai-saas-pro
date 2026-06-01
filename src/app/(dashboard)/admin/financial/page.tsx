'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getUserPermissions } from '@/lib/permissions';

import FinancialKPIs from '@/components/financial/FinancialKPIs';
import AgencyTable from '@/components/financial/AgencyTable';
import ClientsTable from '@/components/financial/ClientsTable';
import AdminUsageView from '@/components/financial/AdminUsageView';
import UsageAlerts from '@/components/financial/UsageAlerts';
import RevenueSourcesTable from '@/components/financial/RevenueSourcesTable';

export default function FinancialPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.replace('/auth');
        return;
      }
      
      const isMasterAdmin = session.user.app_metadata?.role === 'master_admin';
      
      let determinedRole = '';

      const perms = await getUserPermissions(supabase, session.user);
      const isAuth = perms && perms.canViewRevenue;

      if (isMasterAdmin) {
        determinedRole = 'master_admin';
      } else {
        const { data: agency } = await supabase.from('agencies').select('id').eq('user_id', session.user.id).maybeSingle();
        if (agency) {
          determinedRole = 'super_admin';
        } else if (isAuth) {
          determinedRole = 'admin';
        }
      }

      if (!['master_admin', 'super_admin', 'admin'].includes(determinedRole)) {
        router.replace('/admin');
        return;
      }

      setRole(determinedRole);
      await fetchFinancialData(determinedRole, session.user.id);
    };
    checkAuth();
  }, [router]);

  const fetchFinancialData = async (userRole: string, currentUserId: string) => {
    try {
      if (userRole === 'master_admin') {
        const { data: agencies } = await supabase.from('agencies').select('*');
        const { data: tenants } = await supabase.from('tenants').select('id, name, status, revenue, agency_id, plan_type');
        setData({ agencies: agencies || [], tenants: tenants || [] });
      } else if (userRole === 'super_admin') {
        // Safe query for Super Admin - no commission_rate requested
        const { data: agency } = await supabase.from('agencies').select('id, name, messages_used, messages_limit, voice_minutes_used, voice_minutes_limit, plan_type').eq('user_id', currentUserId).maybeSingle();
        
        if (agency) {
          const { data: tenants } = await supabase.from('tenants').select('id, name, plan_type, messages_used, messages_limit, voice_minutes_used, voice_minutes_limit, subscription_end_date, status, revenue').eq('agency_id', agency.id);
          setData({ agency, tenants: tenants || [] });
        }
      } else if (userRole === 'admin') {
        const { data: tenant } = await supabase.from('tenants').select('id, name, plan_type, messages_used, messages_limit, voice_minutes_used, voice_minutes_limit, subscription_end_date, status, revenue').eq('user_id', currentUserId).maybeSingle();
        setData({ tenant });
      }
    } catch (err) {
      console.error('Error fetching financial data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Loader2 className="animate-spin" size={48} color="var(--accent-primary)" />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', color: 'var(--text-main)' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '2rem' }}>التحليل المالي والاستهلاك</h1>
      
      <UsageAlerts role={role!} data={data} />
      <FinancialKPIs role={role!} data={data} />

      {role === 'master_admin' && (
        <>
          <RevenueSourcesTable data={data} />
          <AgencyTable data={data} />
        </>
      )}
      {role === 'super_admin' && <ClientsTable data={data} />}
      {role === 'admin' && <AdminUsageView data={data} />}
    </div>
  );
}
