'use client';

import React from 'react';
import Link from 'next/link';
import {
  DollarSign,
  Building2,
  Users,
  MessageSquare,
  Wallet,
  ShieldAlert,
  TrendingUp,
  Layers,
  ArrowRightLeft,
  ChevronRight,
  Activity,
  AlertCircle
} from 'lucide-react';

interface RecentAgency {
  id: string;
  name: string;
  plan_type: string;
  status: string;
  created_at: string;
  tenants_count: number;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  price_yearly: number;
  is_active: boolean;
  agencies_count?: number;
  revenue?: number;
}

interface AuditLog {
  id: string;
  action_type: string;
  details: string;
  created_at: string;
  severity: string;
}

interface TopWalletAgency {
  id: string;
  name: string;
  wallet_balance: number;
  plan_type: string;
  created_at: string;
}

interface MasterOverviewUIProps {
  agenciesCount: number;
  tenantsCount: number;
  totalMessagesToday: number;
  expiringCount: number;
  highUsageCount: number;
  recentAgencies: RecentAgency[];
  totalRevenue: number;
  agenciesGrowth: number;
  usageRate: number;
  plans: Plan[];
  logs: AuditLog[];
  topWallets: TopWalletAgency[];
  totalWalletBalance: number;
}

export function MasterOverviewUI({
  agenciesCount,
  tenantsCount,
  totalMessagesToday,
  expiringCount,
  highUsageCount,
  recentAgencies,
  totalRevenue,
  agenciesGrowth,
  usageRate,
  plans,
  logs,
  topWallets,
  totalWalletBalance
}: MasterOverviewUIProps) {

  // Helper formats
  const formatCurrency = (num: number) => {
    return '$' + num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return '—';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'high':
      case 'critical':
        return 'text-red-400 bg-red-500/10 border border-red-500/20';
      case 'medium':
      case 'warning':
        return 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20';
      default:
        return 'text-blue-400 bg-blue-500/10 border border-blue-500/20';
    }
  };

  return (
    <div dir="rtl" className="p-6 space-y-8 max-w-[1600px] mx-auto text-gray-100 min-h-screen">
      
      {/* ─── Top Header ─── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Layers className="text-purple-500" size={32} />
            نظرة عامة شاملة (Master Overview)
          </h1>
          <p className="text-gray-400 mt-2 text-sm max-w-2xl leading-relaxed">
            لوحة الإحصائيات المركزية لمشرف النظام العام لمراقبة الأداء المالي، نمو الوكالات، أرصدة المحافظ، وسجلات المراقبة الأمنية الحية.
          </p>
        </div>
      </div>

      {/* ─── Primary KPI Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total Platform Revenue */}
        <div className="relative group overflow-hidden bg-gray-900/40 border border-gray-800 rounded-2xl p-6 transition-all hover:border-purple-500/30 hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-gray-400 text-sm font-medium">إجمالي الإيرادات</span>
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-purple-400 mb-2 font-mono">
            {formatCurrency(totalRevenue)}
          </div>
          <p className="text-xs text-gray-500">إجمالي مدفوعات الوكالات والعملاء المباشرين</p>
        </div>

        {/* Resellers count */}
        <div className="relative group overflow-hidden bg-gray-900/40 border border-gray-800 rounded-2xl p-6 transition-all hover:border-emerald-500/30 hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-gray-400 text-sm font-medium">الوكالات المسجلة</span>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Building2 size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-400 mb-2 font-mono">
            {agenciesCount} <span className="text-sm font-normal text-gray-500">وكالة</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
            <TrendingUp size={14} />
            <span>+{agenciesGrowth}% نمو شهري</span>
          </div>
        </div>

        {/* Total Customers */}
        <div className="relative group overflow-hidden bg-gray-900/40 border border-gray-800 rounded-2xl p-6 transition-all hover:border-blue-500/30 hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-gray-400 text-sm font-medium">العملاء الكلي</span>
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
              <Users size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-blue-400 mb-2 font-mono">
            {tenantsCount} <span className="text-sm font-normal text-gray-500">نشاط تجاري</span>
          </div>
          <p className="text-xs text-gray-500">العيادات، المطاعم، والمتاجر النشطة بالكامل</p>
        </div>

        {/* Total Resellers Wallets Balance */}
        <div className="relative group overflow-hidden bg-gray-900/40 border border-gray-800 rounded-2xl p-6 transition-all hover:border-yellow-500/30 hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-gray-400 text-sm font-medium">إجمالي رصيد المحافظ</span>
            <div className="p-3 rounded-xl bg-yellow-500/10 text-yellow-400">
              <Wallet size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-yellow-400 mb-2 font-mono">
            {formatCurrency(totalWalletBalance)}
          </div>
          <p className="text-xs text-gray-500">مجموع أرصدة الشحن المودعة بوكالات إعادة البيع</p>
        </div>

      </div>

      {/* ─── Secondary KPIs / Usage ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Messages sent today */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-gray-400 text-sm font-medium block">رسائل الواتساب والـ AI اليوم</span>
            <span className="text-2xl font-black text-white font-mono">{totalMessagesToday.toLocaleString('ar-EG')}</span>
          </div>
          <div className="p-4 rounded-full bg-cyan-500/10 text-cyan-400">
            <MessageSquare size={24} />
          </div>
        </div>

        {/* Platform usage rate */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 space-y-3">
          <div className="flex justify-between items-center text-sm font-medium">
            <span className="text-gray-400">معدل استهلاك رصيد المشتركين</span>
            <span className="text-purple-400">{Math.round(usageRate)}%</span>
          </div>
          <div className="w-full bg-gray-950 rounded-full h-2">
            <div className="bg-purple-600 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, usageRate))}%` }}></div>
          </div>
        </div>

        {/* Status/Alert indicators */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 flex justify-around items-center">
          <div className="text-center space-y-1">
            <span className="text-gray-500 text-xs font-semibold block uppercase">أرصدة حرجة</span>
            <span className={`text-xl font-black ${highUsageCount > 0 ? 'text-orange-400' : 'text-gray-400'}`}>{highUsageCount}</span>
          </div>
          <div className="h-8 w-px bg-gray-800"></div>
          <div className="text-center space-y-1">
            <span className="text-gray-500 text-xs font-semibold block uppercase">ينتهي قريباً</span>
            <span className={`text-xl font-black ${expiringCount > 0 ? 'text-red-400' : 'text-gray-400'}`}>{expiringCount}</span>
          </div>
        </div>

      </div>

      {/* ─── Three-column Ledgers ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 1. Plans distributions */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-gray-800 pb-3">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Layers size={18} className="text-purple-400" />
              توزيع المشتركين على الباقات
            </h3>
            <Link href="/master-admin/plans" className="text-xs text-purple-400 hover:underline">إدارة الباقات</Link>
          </div>

          <div className="space-y-4">
            {plans.slice(0, 4).map((plan) => (
              <div key={plan.id} className="p-3.5 rounded-xl bg-gray-950/40 border border-gray-850 flex justify-between items-center transition-all hover:bg-gray-950/60">
                <div className="space-y-1">
                  <span className="text-sm font-bold text-white">{plan.name}</span>
                  <span className="text-[10px] text-gray-500 bg-gray-900 px-2 py-0.5 rounded border border-gray-800 font-mono block w-fit">{plan.slug}</span>
                </div>
                <div className="text-left space-y-1">
                  <span className="text-sm font-black text-purple-400 font-mono block">{plan.agencies_count || 0} وكالة</span>
                  <span className="text-[11px] text-gray-500 font-mono">{formatCurrency(plan.price_monthly || 0)} / شهرياً</span>
                </div>
              </div>
            ))}
            {plans.length === 0 && (
              <div className="text-center py-6 text-gray-500 text-sm">لا توجد باقات لعرضها.</div>
            )}
          </div>
        </div>

        {/* 2. Top agency wallets */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-gray-800 pb-3">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Wallet size={18} className="text-yellow-400" />
              أعلى محافظ الوكالات رصيداً
            </h3>
            <Link href="/master-admin/wallet" className="text-xs text-yellow-400 hover:underline">إدارة المحافظ</Link>
          </div>

          <div className="space-y-4">
            {topWallets.map((agency) => (
              <div key={agency.id} className="p-3.5 rounded-xl bg-gray-950/40 border border-gray-850 flex justify-between items-center transition-all hover:bg-gray-950/60">
                <div className="space-y-1">
                  <span className="text-sm font-bold text-white block max-w-[180px] truncate">{agency.name}</span>
                  <span className="text-[10px] text-gray-500">{formatDate(agency.created_at)}</span>
                </div>
                <div className="text-left">
                  <span className="text-sm font-black text-yellow-400 font-mono block">{formatCurrency(agency.wallet_balance)}</span>
                  <span className="text-[10px] uppercase text-gray-500 bg-gray-900/80 px-2 py-0.5 rounded border border-gray-800/80 font-mono inline-block mt-1">{agency.plan_type}</span>
                </div>
              </div>
            ))}
            {topWallets.length === 0 && (
              <div className="text-center py-6 text-gray-500 text-sm">لا توجد محافظ وكالات متاحة.</div>
            )}
          </div>
        </div>

        {/* 3. Live audit security logs */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-gray-800 pb-3">
            <h3 className="font-bold text-white flex items-center gap-2">
              <ShieldAlert size={18} className="text-red-400" />
              أحدث سجلات المراقبة الأمنية
            </h3>
            <Link href="/master-admin/logs" className="text-xs text-red-400 hover:underline">سجلات المراقبة</Link>
          </div>

          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="p-3.5 rounded-xl bg-gray-950/40 border border-gray-850 flex items-start justify-between gap-3 transition-all hover:bg-gray-950/60">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${getSeverityColor(log.severity)}`}>
                      {log.severity || 'info'}
                    </span>
                    <span className="text-[11px] font-bold text-white font-mono block truncate">{log.action_type}</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-normal truncate">{log.details}</p>
                </div>
                <span className="text-[9px] text-gray-500 font-mono shrink-0 whitespace-nowrap">{new Date(log.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-center py-6 text-gray-500 text-sm">لا توجد سجلات مراقبة مسجلة.</div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
