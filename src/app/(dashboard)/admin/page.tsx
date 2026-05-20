'use client';
import React, { useEffect, useState } from 'react';
import { MasterDashboardUI } from '@/components/master-admin/MasterDashboardUI';
import ClientDashboard from '@/components/dashboard/ClientDashboard';
import { supabase } from '@/lib/supabase';
import { CardSkeleton } from '@/components/ui/Skeleton';

interface RecentAgency {
  readonly id: string;
  readonly name: string;
  readonly plan_type: 'starter' | 'growth' | 'pro' | 'vip';
  readonly status: 'active' | 'inactive' | 'suspended' | 'pending' | 'unpaid';
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
  const validStatuses = ['active', 'inactive', 'suspended', 'pending', 'unpaid'] as const;

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

        const userEmail = (session.user.email || '').toLowerCase();
        const masterEmails = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || '')
          .replace(/[^\x20-\x7E]/g, '')
          .split(',')
          .map(e => e.trim().toLowerCase())
          .filter(Boolean);
        const isMasterByEmail = !!userEmail && masterEmails.includes(userEmail);
        
        let isMasterByRpc = false;
        try {
          const { data } = await withTimeout(Promise.resolve(supabase.rpc('is_master_admin')), 3000) as any;
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
        const { data: rpcData, error } = await supabase.rpc('get_master_dashboard_data');
        if (error || !rpcData) {
           logError('master_rpc_failed');
           return;
        }
        
        let recentAgencies: RecentAgency[] = [];
        if (Array.isArray(rpcData.recentAgencies)) {
          recentAgencies = rpcData.recentAgencies.map(validateAgency).filter((a: any): a is RecentAgency => a !== null);
        }

        setDashboardData({
          agenciesCount: safeNumber(rpcData.agenciesCount),
          tenantsCount: safeNumber(rpcData.tenantsCount),
          totalMessagesToday: safeNumber(rpcData.totalMessagesToday),
          expiringCount: safeNumber(rpcData.expiringCount),
          highUsageCount: safeNumber(rpcData.highUsageCount),
          recentAgencies,
          totalRevenue: safeNumber(rpcData.totalRevenue),
          agenciesGrowth: safeNumber(rpcData.agenciesGrowth),
          usageRate: safeNumber(rpcData.usageRate)
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
