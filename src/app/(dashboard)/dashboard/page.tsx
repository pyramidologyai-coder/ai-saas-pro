'use client';
import React, { useEffect, useState } from 'react';
import { MasterDashboardUI } from '@/components/dashboard/MasterDashboardUI';
import ClientDashboard from '@/components/dashboard/ClientDashboard';
import { supabase } from '@/lib/supabase';
import { CardSkeleton } from '@/components/ui/Skeleton';

interface RecentAgency {
  readonly id: string;
  readonly name: string;
  readonly plan_type: 'starter' | 'growth' | 'pro' | 'vip';
  readonly status: 'active' | 'inactive' | 'suspended';
  readonly created_at: string;
  readonly tenants_count: number;
}

interface MasterDashboardData {
  readonly agenciesCount: number;
  readonly tenantsCount: number;
  readonly totalMessagesToday: number;
  readonly expiringCount: number;
  readonly highUsageCount: number;
  readonly recentAgencies: RecentAgency[];
  readonly totalRevenue: number;
  readonly agenciesGrowth: number;
  readonly usageRate: number;
}

const DASHBOARD_DEFAULTS: Readonly<MasterDashboardData> = {
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

function logError(context: string): void {
  console.error(`[ERROR] ${context} | ${new Date().toISOString()}`);
}

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value) && value >= 0) return value;
  return fallback;
}

function isValidISODate(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !isNaN(date.getTime()) && value.includes('T');
}

function validateAgency(agency: unknown): RecentAgency | null {
  if (!agency || typeof agency !== 'object') {
    return null;
  }
  const a = agency as Record<string, unknown>;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof a.id !== 'string' || !uuidRegex.test(a.id)) return null;

  const validPlanTypes = ['starter', 'growth', 'pro', 'vip'] as const;
  const validStatuses = ['active', 'inactive', 'suspended'] as const;

  return {
    id: a.id,
    name: typeof a.name === 'string' && a.name.trim().length > 0 && a.name.trim().length <= 200 ? a.name.trim() : 'غير معروف',
    plan_type: validPlanTypes.includes(a.plan_type as typeof validPlanTypes[number]) ? a.plan_type as RecentAgency['plan_type'] : 'starter',
    status: validStatuses.includes(a.status as typeof validStatuses[number]) ? a.status as RecentAgency['status'] : 'inactive',
    created_at: isValidISODate(a.created_at) ? a.created_at as string : new Date().toISOString(),
    tenants_count: safeNumber(a.tenants_count)
  };
}

async function withTimeout<T>(promise: any, ms = 5000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
  try {
    const result = await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('timeout')), ms);
      })
    ]);
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    return result as T;
  } catch (error) {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    throw error;
  }
}

export default function DashboardPage() {
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  
  const [loadingData, setLoadingData] = useState(true);
  const [dashboardData, setDashboardData] = useState<MasterDashboardData>(DASHBOARD_DEFAULTS);

  useEffect(() => {
    async function checkAuthAndRole() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.user) {
          setIsMasterAdmin(false);
          setLoadingAuth(false);
          return;
        }

        const userEmail = session.user.email;
        const masterEmails = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
        const isMasterByEmail = !!userEmail && masterEmails.includes(userEmail);
        
        let isMasterByRpc = false;
        try {
          const { data } = await withTimeout(supabase.rpc('verify_master_admin_role'), 3000) as any;
          isMasterByRpc = !!data;
        } catch (e) {
          // Ignore RPC error if they match email
        }

        setIsMasterAdmin(isMasterByEmail || isMasterByRpc);
      } catch (err) {
        setIsMasterAdmin(false);
      } finally {
        setLoadingAuth(false);
      }
    }
    
    checkAuthAndRole();
  }, []);

  useEffect(() => {
    if (!isMasterAdmin) return;

    async function fetchMasterData() {
      try {
        const nowUTC = new Date();
        const in7DaysUTC = new Date(nowUTC.getTime() + 7 * 24 * 60 * 60 * 1000);
        const thisMonthStart = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), 1));
        const lastMonthStart = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth() - 1, 1));

        const [
          agenciesResult,
          tenantsResult,
          messagesResult,
          expiringResult,
          highUsageResult,
          recentAgenciesResult,
          revenueResult,
          thisMonthAgenciesResult,
          lastMonthAgenciesResult,
          usageRateResult
        ] = (await Promise.allSettled([
          withTimeout(supabase.from('agencies').select('id', { count: 'exact', head: true }).eq('status', 'active')),
          withTimeout(supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('status', 'active')),
          withTimeout(supabase.rpc('count_today_messages')),
          withTimeout(supabase.from('agencies').select('id', { count: 'exact', head: true }).not('subscription_end_date', 'is', null).gte('subscription_end_date', nowUTC.toISOString()).lte('subscription_end_date', in7DaysUTC.toISOString())),
          withTimeout(supabase.rpc('count_high_usage_tenants')),
          withTimeout(supabase.from('agencies').select(\`
            id,
            name,
            plan_type,
            status,
            created_at,
            tenants_count:tenants(count)
          \`).order('created_at', { ascending: false }).limit(5)),
          withTimeout(supabase.rpc('calculate_master_revenue')),
          withTimeout(supabase.from('agencies').select('id', { count: 'exact', head: true }).gte('created_at', thisMonthStart.toISOString())),
          withTimeout(supabase.from('agencies').select('id', { count: 'exact', head: true }).gte('created_at', lastMonthStart.toISOString()).lt('created_at', thisMonthStart.toISOString())),
          withTimeout(supabase.rpc('calculate_usage_rate'))
        ])) as any[];

        let agenciesCount = DASHBOARD_DEFAULTS.agenciesCount;
        if (agenciesResult.status === 'fulfilled' && !agenciesResult.value.error) {
          agenciesCount = safeNumber(agenciesResult.value.count);
        } else { logError('agencies_failed'); }

        let tenantsCount = DASHBOARD_DEFAULTS.tenantsCount;
        if (tenantsResult.status === 'fulfilled' && !tenantsResult.value.error) {
          tenantsCount = safeNumber(tenantsResult.value.count);
        } else { logError('tenants_failed'); }

        let totalMessagesToday = DASHBOARD_DEFAULTS.totalMessagesToday;
        if (messagesResult.status === 'fulfilled' && !messagesResult.value.error) {
          totalMessagesToday = safeNumber(messagesResult.value.data);
        } else { logError('messages_failed'); }

        let expiringCount = DASHBOARD_DEFAULTS.expiringCount;
        if (expiringResult.status === 'fulfilled' && !expiringResult.value.error) {
          expiringCount = safeNumber(expiringResult.value.count);
        } else { logError('expiring_failed'); }

        let highUsageCount = DASHBOARD_DEFAULTS.highUsageCount;
        if (highUsageResult.status === 'fulfilled' && !highUsageResult.value.error) {
          highUsageCount = safeNumber(highUsageResult.value.data);
        } else { logError('high_usage_failed'); }

        let recentAgencies: RecentAgency[] = [];
        if (recentAgenciesResult.status === 'fulfilled' && !recentAgenciesResult.value.error && Array.isArray(recentAgenciesResult.value.data)) {
          recentAgencies = recentAgenciesResult.value.data.map(validateAgency).filter((a: any): a is RecentAgency => a !== null);
        } else { logError('recent_agencies_failed'); }

        let totalRevenue = DASHBOARD_DEFAULTS.totalRevenue;
        if (revenueResult.status === 'fulfilled' && !revenueResult.value.error) {
          totalRevenue = safeNumber(revenueResult.value.data);
        } else { logError('revenue_failed'); }

        const thisMonthCount = safeNumber(thisMonthAgenciesResult.status === 'fulfilled' ? thisMonthAgenciesResult.value.count : 0);
        const lastMonthCount = safeNumber(lastMonthAgenciesResult.status === 'fulfilled' ? lastMonthAgenciesResult.value.count : 0);

        const agenciesGrowth = lastMonthCount > 0 ? Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100) : thisMonthCount > 0 ? 100 : 0;

        let usageRate = DASHBOARD_DEFAULTS.usageRate;
        if (usageRateResult.status === 'fulfilled' && !usageRateResult.value.error) {
          usageRate = safeNumber(usageRateResult.value.data);
        } else { logError('usage_rate_failed'); }

        setDashboardData({
          agenciesCount,
          tenantsCount,
          totalMessagesToday,
          expiringCount,
          highUsageCount,
          recentAgencies,
          totalRevenue,
          agenciesGrowth,
          usageRate
        });

      } catch (err) {
        console.error('Failed to fetch master data', err);
      } finally {
        setLoadingData(false);
      }
    }

    fetchMasterData();
  }, [isMasterAdmin]);

  if (loadingAuth) {
    return <div style={{ padding: '2rem' }}><CardSkeleton /><CardSkeleton /></div>;
  }

  if (!isMasterAdmin) {
    return <ClientDashboard />;
  }

  if (loadingData) {
    return <div style={{ padding: '2rem' }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;
  }

  return <MasterDashboardUI {...dashboardData} />;
}
