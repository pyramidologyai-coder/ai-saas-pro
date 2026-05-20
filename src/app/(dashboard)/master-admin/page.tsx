import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { MasterDashboardUI } from '@/components/master-admin/MasterDashboardUI';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function MasterAdminPage() {
  const supabase = createServerComponentClient(
    { cookies },
    { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_ANON_KEY }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/auth');
  }

  // 1. غيّر الـ Auth من Email لـ RPC:
  let { data: isMaster } = await supabase.rpc('verify_master_admin_role');
  
  // Fallback in case verify_master_admin_role doesn't exist but is_master_admin does
  if (isMaster === null || isMaster === undefined) {
    const { data: isMasterFallback } = await supabase.rpc('is_master_admin');
    isMaster = isMasterFallback;
  }

  if (!isMaster) {
    redirect('/admin');
  }

  // Fetch dashboard data
  const { data: rpcData, error } = await supabase.rpc('get_master_dashboard_data');
  
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

  if (!error && rpcData) {
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
