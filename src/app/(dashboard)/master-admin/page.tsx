import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { MasterDashboardUI } from '@/components/master-admin/MasterDashboardUI';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function MasterAdminPage() {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient(
    { cookies: () => cookieStore as any },
    { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_ANON_KEY }
  );

  const [userRes, isMasterRes, dashboardRes] = await Promise.allSettled([
    supabase.auth.getUser(),
    supabase.rpc('verify_master_admin_role'),
    supabase.rpc('get_master_dashboard_data')
  ]);

  const user = userRes.status === 'fulfilled' ? userRes.value.data.user : null;
  let isMaster = isMasterRes.status === 'fulfilled' ? isMasterRes.value.data : false;
  const rpcData = dashboardRes.status === 'fulfilled' ? dashboardRes.value.data : null;

  if (!user) {
    redirect('/auth');
  }

  if (!isMaster) {
    redirect('/admin');
  }

  let dashboardData = {
    agenciesCount: 0,
    tenantsCount: 0,
    totalMessagesToday: 0,
    expiringCount: 0,
    highUsageCount: 0,
    recentAgencies: [],
    totalRevenue: 0,
    agenciesGrowth: 0,
    usageRate: 0
  };

  if (rpcData) {
    dashboardData = {
      agenciesCount: Number(rpcData.agenciesCount) || 0,
      tenantsCount: Number(rpcData.tenantsCount) || 0,
      totalMessagesToday: Number(rpcData.totalMessagesToday) || 0,
      expiringCount: Number(rpcData.expiringCount) || 0,
      highUsageCount: Number(rpcData.highUsageCount) || 0,
      recentAgencies: Array.isArray(rpcData.recentAgencies) ? rpcData.recentAgencies : [],
      totalRevenue: Number(rpcData.totalRevenue) || 0,
      agenciesGrowth: Number(rpcData.agenciesGrowth) || 0,
      usageRate: Number(rpcData.usageRate) || 0
    };
  }

  return (
    <MasterDashboardUI {...dashboardData} />
  );
}
