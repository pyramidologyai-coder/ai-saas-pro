import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { MasterOverviewUI } from '@/components/master-admin/MasterOverviewUI';

export const dynamic = 'force-dynamic';

export default async function MasterOverviewPage() {
  const supabase = await createClient();

  const [userRes, isMasterRes, dashboardRes, plansRes, logsRes, walletsRes] = await Promise.allSettled([
    supabase.auth.getUser(),
    supabase.rpc('verify_master_admin_role'),
    supabase.rpc('get_master_dashboard_data'),
    supabase.rpc('get_plans_with_stats'),
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('agencies').select('id, name, wallet_balance, plan_type, created_at').order('wallet_balance', { ascending: false }).limit(5)
  ]);

  const user = userRes.status === 'fulfilled' ? userRes.value.data.user : null;
  const isMaster = isMasterRes.status === 'fulfilled' ? isMasterRes.value.data : false;

  if (!user) {
    redirect('/auth');
  }

  if (!isMaster && user.app_metadata?.role !== 'master_admin') {
    redirect('/admin');
  }

  const rpcData = dashboardRes.status === 'fulfilled' ? dashboardRes.value.data : null;
  const plans = plansRes.status === 'fulfilled' ? plansRes.value.data || [] : [];
  const logs = logsRes.status === 'fulfilled' ? logsRes.value.data || [] : [];
  const topWallets = walletsRes.status === 'fulfilled' ? walletsRes.value.data || [] : [];

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

  // Calculate total platform wallet balance sum
  const { data: totalBalanceRes } = await supabase.from('agencies').select('wallet_balance');
  const totalWalletBalance = (totalBalanceRes || []).reduce((acc: number, curr: any) => acc + (Number(curr.wallet_balance) || 0), 0);

  return (
    <MasterOverviewUI
      {...dashboardData}
      plans={plans}
      logs={logs}
      topWallets={topWallets}
      totalWalletBalance={totalWalletBalance}
    />
  );
}
