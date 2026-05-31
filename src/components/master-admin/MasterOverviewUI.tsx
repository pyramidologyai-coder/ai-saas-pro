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
        return 'text-[var(--error-text)] bg-[var(--error-bg)] border border-[var(--error-bg)]';
      case 'medium':
      case 'warning':
        return 'text-amber-600 dark:text-yellow-400 bg-amber-500/10 dark:bg-yellow-500/10 border border-[var(--glass-border)]';
      default:
        return 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20';
    }
  };

  return (
    <div dir="rtl" className="p-6 space-y-8 max-w-[1600px] mx-auto text-[var(--text-main)] min-h-screen bg-[var(--bg-color)]">
      
      {/* ─── Top Header ─── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-[var(--glass-border)]">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-main)] flex items-center gap-3">
            <Layers className="text-[var(--accent-primary)]" size={32} />
            نظرة عامة شاملة (Master Overview)
          </h1>
          <p className="text-[var(--text-dim)] mt-2 text-sm max-w-2xl leading-relaxed">
            لوحة الإحصائيات المركزية لمشرف النظام العام لمراقبة الأداء المالي، نمو الوكالات، أرصدة المحافظ، وسجلات المراقبة الأمنية الحية.
          </p>
        </div>
      </div>

      {/* ─── Primary KPI Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total Platform Revenue */}
        <div className="relative group overflow-hidden bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-6 transition-all hover:border-[var(--accent-primary)]/30 hover:scale-[1.02] shadow-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-primary)]/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-[var(--text-dim)] text-sm font-medium">إجمالي الإيرادات</span>
            <div className="p-3 rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-[var(--accent-primary)] mb-2 font-mono">
            {formatCurrency(totalRevenue)}
          </div>
          <p className="text-xs text-[var(--text-dim)]">إجمالي مدفوعات الوكالات والعملاء المباشرين</p>
        </div>

        {/* Resellers count */}
        <div className="relative group overflow-hidden bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-6 transition-all hover:border-[var(--success-text)]/30 hover:scale-[1.02] shadow-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--success-text)]/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-[var(--text-dim)] text-sm font-medium">الوكالات المسجلة</span>
            <div className="p-3 rounded-xl bg-[var(--success-bg)] text-[var(--success-text)]">
              <Building2 size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-[var(--success-text)] mb-2 font-mono">
            {agenciesCount} <span className="text-sm font-normal text-[var(--text-dim)]">وكالة</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--success-text)] font-semibold">
            <TrendingUp size={14} />
            <span>+{agenciesGrowth}% نمو شهري</span>
          </div>
        </div>

        {/* Total Customers */}
        <div className="relative group overflow-hidden bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-6 transition-all hover:border-blue-500/30 hover:scale-[1.02] shadow-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-[var(--text-dim)] text-sm font-medium">العملاء الكلي</span>
            <div className="p-3 rounded-xl bg-[var(--bg-input)] text-blue-500 dark:text-blue-400 border border-[var(--glass-border)]">
              <Users size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-blue-500 dark:text-blue-400 mb-2 font-mono">
            {tenantsCount} <span className="text-sm font-normal text-[var(--text-dim)]">نشاط تجاري</span>
          </div>
          <p className="text-xs text-[var(--text-dim)]">العيادات، المطاعم، والمتاجر النشطة بالكامل</p>
        </div>

        {/* Total Resellers Wallets Balance */}
        <div className="relative group overflow-hidden bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-6 transition-all hover:border-yellow-500/30 hover:scale-[1.02] shadow-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-[var(--text-dim)] text-sm font-medium">إجمالي رصيد المحافظ</span>
            <div className="p-3 rounded-xl bg-[var(--bg-input)] text-amber-500 dark:text-yellow-400 border border-[var(--glass-border)]">
              <Wallet size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-500 dark:text-yellow-400 mb-2 font-mono">
            {formatCurrency(totalWalletBalance)}
          </div>
          <p className="text-xs text-[var(--text-dim)]">مجموع أرصدة الشحن المودعة بوكالات إعادة البيع</p>
        </div>

      </div>

      {/* ─── Secondary KPIs / Usage ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Messages sent today */}
        <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-6 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[var(--text-dim)] text-sm font-medium block">رسائل الواتساب والـ AI اليوم</span>
            <span className="text-2xl font-black text-[var(--text-main)] font-mono">{totalMessagesToday.toLocaleString('ar-EG')}</span>
          </div>
          <div className="p-4 rounded-full bg-[var(--bg-input)] text-cyan-500 dark:text-cyan-400 border border-[var(--glass-border)]">
            <MessageSquare size={24} />
          </div>
        </div>

        {/* Platform usage rate */}
        <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-6 space-y-3 shadow-sm">
          <div className="flex justify-between items-center text-sm font-medium">
            <span className="text-[var(--text-dim)]">معدل استهلاك رصيد المشتركين</span>
            <span className="text-[var(--accent-primary)]">{Math.round(usageRate)}%</span>
          </div>
          <div className="w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-full h-2">
            <div className="bg-[var(--accent-primary)] h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, usageRate))}%` }}></div>
          </div>
        </div>

        {/* Status/Alert indicators */}
        <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-6 flex justify-around items-center shadow-sm">
          <div className="text-center space-y-1">
            <span className="text-[var(--text-dim)] text-xs font-semibold block uppercase">أرصدة حرجة</span>
            <span className={`text-xl font-black ${highUsageCount > 0 ? 'text-orange-500 dark:text-orange-400' : 'text-[var(--text-dim)]'}`}>{highUsageCount}</span>
          </div>
          <div className="h-8 w-px bg-[var(--glass-border)]"></div>
          <div className="text-center space-y-1">
            <span className="text-[var(--text-dim)] text-xs font-semibold block uppercase">ينتهي قريباً</span>
            <span className={`text-xl font-black ${expiringCount > 0 ? 'text-[var(--error-text)]' : 'text-[var(--text-dim)]'}`}>{expiringCount}</span>
          </div>
        </div>

      </div>

      {/* ─── Three-column Ledgers ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 1. Plans distributions */}
        <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b border-[var(--glass-border)] pb-3">
            <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2">
              <Layers size={18} className="text-[var(--accent-primary)]" />
              توزيع المشتركين على الباقات
            </h3>
            <Link href="/master-admin/plans" className="text-xs text-[var(--accent-primary)] hover:underline">إدارة الباقات</Link>
          </div>

          <div className="space-y-4">
            {plans.slice(0, 4).map((plan) => (
              <div key={plan.id} className="p-3.5 rounded-xl bg-[var(--bg-input)] border border-[var(--glass-border)] flex justify-between items-center transition-all hover:bg-[var(--hover-bg)]">
                <div className="space-y-1">
                  <span className="text-sm font-bold text-[var(--text-main)]">{plan.name}</span>
                  <span className="text-[10px] text-[var(--text-dim)] bg-[var(--bg-color)] px-2 py-0.5 rounded border border-[var(--glass-border)] font-mono block w-fit">{plan.slug}</span>
                </div>
                <div className="text-left space-y-1">
                  <span className="text-sm font-black text-[var(--accent-primary)] font-mono block">{plan.agencies_count || 0} وكالة</span>
                  <span className="text-[11px] text-[var(--text-dim)] font-mono">{formatCurrency(plan.price_monthly || 0)} / شهرياً</span>
                </div>
              </div>
            ))}
            {plans.length === 0 && (
              <div className="text-center py-6 text-[var(--text-dim)] text-sm">لا توجد باقات لعرضها.</div>
            )}
          </div>
        </div>

        {/* 2. Top agency wallets */}
        <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b border-[var(--glass-border)] pb-3">
            <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2">
              <Wallet size={18} className="text-amber-500 dark:text-yellow-400" />
              أعلى محافظ الوكالات رصيداً
            </h3>
            <Link href="/master-admin/wallet" className="text-xs text-amber-500 dark:text-yellow-400 hover:underline">إدارة المحافظ</Link>
          </div>

          <div className="space-y-4">
            {topWallets.map((agency) => (
              <div key={agency.id} className="p-3.5 rounded-xl bg-[var(--bg-input)] border border-[var(--glass-border)] flex justify-between items-center transition-all hover:bg-[var(--hover-bg)]">
                <div className="space-y-1">
                  <span className="text-sm font-bold text-[var(--text-main)] block max-w-[180px] truncate">{agency.name}</span>
                  <span className="text-[10px] text-[var(--text-dim)]">{formatDate(agency.created_at)}</span>
                </div>
                <div className="text-left">
                  <span className="text-sm font-black text-amber-500 dark:text-yellow-400 font-mono block">{formatCurrency(agency.wallet_balance)}</span>
                  <span className="text-[10px] uppercase text-[var(--text-dim)] bg-[var(--bg-color)] px-2 py-0.5 rounded border border-[var(--glass-border)] font-mono inline-block mt-1">{agency.plan_type}</span>
                </div>
              </div>
            ))}
            {topWallets.length === 0 && (
              <div className="text-center py-6 text-[var(--text-dim)] text-sm">لا توجد محافظ وكالات متاحة.</div>
            )}
          </div>
        </div>

        {/* 3. Live audit security logs */}
        <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b border-[var(--glass-border)] pb-3">
            <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2">
              <ShieldAlert size={18} className="text-[var(--error-text)]" />
              أحدث سجلات المراقبة الأمنية
            </h3>
            <Link href="/master-admin/logs" className="text-xs text-[var(--error-text)] hover:underline">سجلات المراقبة</Link>
          </div>

          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="p-3.5 rounded-xl bg-[var(--bg-input)] border border-[var(--glass-border)] flex items-start justify-between gap-3 transition-all hover:bg-[var(--hover-bg)]">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${getSeverityColor(log.severity)}`}>
                      {log.severity || 'info'}
                    </span>
                    <span className="text-[11px] font-bold text-[var(--text-main)] font-mono block truncate">{log.action_type}</span>
                  </div>
                  <p className="text-xs text-[var(--text-dim)] leading-normal truncate">{log.details}</p>
                </div>
                <span className="text-[9px] text-[var(--text-dim)] font-mono shrink-0 whitespace-nowrap">{new Date(log.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-center py-6 text-[var(--text-dim)] text-sm">لا توجد سجلات مراقبة مسجلة.</div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
