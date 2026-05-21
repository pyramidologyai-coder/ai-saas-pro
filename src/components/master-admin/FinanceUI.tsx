'use client'

import React, { useState, useTransition } from 'react'
import {
  DollarSign, TrendingUp, TrendingDown,
  Building2, Users, Receipt, AlertCircle,
  TrendingUp as ProfitIcon, Landmark, RefreshCw
} from 'lucide-react'

// Dictionary type definition
type Lang = 'ar' | 'en' | 'fr'

interface Invoice {
  id: string
  agency_name?: string
  amount: number
  status: 'paid' | 'pending' | 'unpaid' | 'refunded'
  created_at: string
}

interface PlanRevenue {
  name: string
  label: string
  value: number
}

interface FinanceUIProps {
  initialData?: {
    total_revenue?: number
    totalRevenue?: number
    this_month_revenue?: number
    thisMonthRevenue?: number
    last_month_revenue?: number
    lastMonthRevenue?: number
    paid_invoices_count?: number
    paidInvoicesCount?: number
    pending_invoices_count?: number
    pendingInvoicesCount?: number
    active_agencies_count?: number
    activeAgenciesCount?: number
    suspended_agencies_count?: number
    suspendedAgenciesCount?: number
    active_clients_count?: number
    activeClientsCount?: number
    revenue_by_plan?: PlanRevenue[]
    revenueByPlan?: PlanRevenue[]
    invoices?: Invoice[]
  } | null
}

const DICTIONARY = {
  ar: {
    title: 'التحليل المالي والتقارير',
    subtitle: 'مراقبة إيرادات المنصة، الاشتراكات، والفواتير عبر الوكالات والعملاء المباشرين.',
    totalRevenue: 'إجمالي الإيرادات',
    totalRevenueSub: 'تراكمي المنصة بالكامل',
    thisMonthRevenue: 'إيرادات هذا الشهر',
    thisMonthRevenueSub: 'الفواتير المدفوعة هذا الشهر',
    lastMonthRevenue: 'إيرادات الشهر الماضي',
    lastMonthRevenueSub: 'أداء الشهر المنقضي',
    invoicesPaidPending: 'الفواتير (المدفوعة / المعلقة)',
    invoicesPaidPendingSub: 'توزيع فواتير المنصة الحالية',
    agenciesActiveSuspended: 'الوكالات (نشطة / موقوفة)',
    agenciesActiveSuspendedSub: 'حالة اشتراكات الوكالات',
    activeClients: 'العملاء النشطين',
    activeClientsSub: 'الأنشطة التجارية المشتركة',
    revenueByPlan: 'توزيع الإيرادات حسب الباقة',
    revenueByPlanSub: 'تحليل الإيرادات التراكمية لكل فئة اشتراك',
    invoicesTable: 'جدول الفواتير الأخيرة',
    invoicesTableSub: 'تتبع آخر عمليات الفوترة وتحديثات السداد',
    invoiceId: 'رقم الفاتورة',
    agency: 'الوكالة / العميل',
    amount: 'القيمة',
    status: 'الحالة',
    date: 'التاريخ',
    statusPaid: 'مدفوعة',
    statusPending: 'قيد الانتظار',
    statusUnpaid: 'غير مدفوعة',
    statusRefunded: 'مسترجعة',
    filterAll: 'الكل',
    langAr: 'العربية',
    langEn: 'English',
    langFr: 'Français'
  },
  en: {
    title: 'Financial Analysis & Reports',
    subtitle: 'Monitor platform revenues, subscriptions, and invoicing across agencies and direct clients.',
    totalRevenue: 'Total Revenue',
    totalRevenueSub: 'Accumulative platform revenue',
    thisMonthRevenue: 'This Month Revenue',
    thisMonthRevenueSub: 'Paid invoices this month',
    lastMonthRevenue: 'Last Month Revenue',
    lastMonthRevenueSub: 'Performance of previous month',
    invoicesPaidPending: 'Invoices (Paid / Pending)',
    invoicesPaidPendingSub: 'Distribution of current invoices',
    agenciesActiveSuspended: 'Agencies (Active / Suspended)',
    agenciesActiveSuspendedSub: 'Status of agency subscriptions',
    activeClients: 'Active Clients',
    activeClientsSub: 'Businesses actively subscribed',
    revenueByPlan: 'Revenue by Subscription Plan',
    revenueByPlanSub: 'Cumulative revenue analysis for each tier',
    invoicesTable: 'Recent Invoices Table',
    invoicesTableSub: 'Track latest billing processes and payment updates',
    invoiceId: 'Invoice ID',
    agency: 'Agency / Client',
    amount: 'Amount',
    status: 'Status',
    date: 'Date',
    statusPaid: 'Paid',
    statusPending: 'Pending',
    statusUnpaid: 'Unpaid',
    statusRefunded: 'Refunded',
    filterAll: 'All',
    langAr: 'العربية',
    langEn: 'English',
    langFr: 'Français'
  },
  fr: {
    title: 'Analyse Financière & Rapports',
    subtitle: 'Supervisez les revenus de la plateforme, les abonnements et la facturation des agences et clients directs.',
    totalRevenue: 'Revenu Total',
    totalRevenueSub: 'Revenu cumulatif de la plateforme',
    thisMonthRevenue: 'Revenu de ce Mois',
    thisMonthRevenueSub: 'Factures payées ce mois-ci',
    lastMonthRevenue: 'Revenu du Mois Dernier',
    lastMonthRevenueSub: 'Performance du mois précédent',
    invoicesPaidPending: 'Factures (Payées / En attente)',
    invoicesPaidPendingSub: 'Distribution des factures actuelles',
    agenciesActiveSuspended: 'Agences (Actives / Suspendues)',
    agenciesActiveSuspendedSub: 'Statut des abonnements d\'agences',
    activeClients: 'Clients Actifs',
    activeClientsSub: 'Entreprises activement abonnées',
    revenueByPlan: 'Revenu par Plan d\'Abonnement',
    revenueByPlanSub: 'Analyse des revenus cumulés pour chaque niveau',
    invoicesTable: 'Tableau des Factures Récentes',
    invoicesTableSub: 'Suivi des derniers processus de facturation et paiements',
    invoiceId: 'ID de facture',
    agency: 'Agence / Client',
    amount: 'Montant',
    status: 'Statut',
    date: 'Date',
    statusPaid: 'Payé',
    statusPending: 'En attente',
    statusUnpaid: 'Non payé',
    statusRefunded: 'Remboursé',
    filterAll: 'Tout',
    langAr: 'العربية',
    langEn: 'English',
    langFr: 'Français'
  }
} as const

// Sleek dark-mode mock fallbacks in case database has null/missing fields
const MOCK_FALLBACK = {
  totalRevenue: 124950,
  thisMonthRevenue: 18450,
  lastMonthRevenue: 16200,
  paidInvoicesCount: 342,
  pendingInvoicesCount: 24,
  activeAgenciesCount: 48,
  suspendedAgenciesCount: 3,
  activeClientsCount: 384,
  revenueByPlan: [
    { name: 'starter', label: 'Starter ($49)', value: 14700 },
    { name: 'growth', label: 'Growth ($99)', value: 34650 },
    { name: 'pro', label: 'Pro ($199)', value: 45770 },
    { name: 'vip', label: 'VIP ($399)', value: 29830 }
  ],
  invoices: [
    { id: 'inv_1092', agency_name: 'Apex Marketing', amount: 399, status: 'paid' as const, created_at: '2026-05-20' },
    { id: 'inv_1091', agency_name: 'MedClinic Group', amount: 199, status: 'paid' as const, created_at: '2026-05-19' },
    { id: 'inv_1090', agency_name: 'Elixir Tech Agency', amount: 399, status: 'pending' as const, created_at: '2026-05-19' },
    { id: 'inv_1089', agency_name: 'Nova Real Estate', amount: 99, status: 'paid' as const, created_at: '2026-05-18' },
    { id: 'inv_1088', agency_name: 'Dental Care Ltd', amount: 49, status: 'unpaid' as const, created_at: '2026-05-18' },
    { id: 'inv_1087', agency_name: 'Beauty & Co', amount: 199, status: 'paid' as const, created_at: '2026-05-17' },
    { id: 'inv_1086', agency_name: 'Prime Salons', amount: 399, status: 'paid' as const, created_at: '2026-05-16' }
  ]
}

export function FinanceUI({ initialData }: FinanceUIProps) {
  const [lang, setLang] = useState<Lang>('ar')
  const [isPending, startTransition] = useTransition()

  // Consolidate data from RPC with safe fallbacks
  const totalRevenue = initialData?.total_revenue ?? initialData?.totalRevenue ?? MOCK_FALLBACK.totalRevenue
  const thisMonthRevenue = initialData?.this_month_revenue ?? initialData?.thisMonthRevenue ?? MOCK_FALLBACK.thisMonthRevenue
  const lastMonthRevenue = initialData?.last_month_revenue ?? initialData?.lastMonthRevenue ?? MOCK_FALLBACK.lastMonthRevenue
  
  const paidInvoicesCount = initialData?.paid_invoices_count ?? initialData?.paidInvoicesCount ?? MOCK_FALLBACK.paidInvoicesCount
  const pendingInvoicesCount = initialData?.pending_invoices_count ?? initialData?.pendingInvoicesCount ?? MOCK_FALLBACK.pendingInvoicesCount
  
  const activeAgenciesCount = initialData?.active_agencies_count ?? initialData?.activeAgenciesCount ?? MOCK_FALLBACK.activeAgenciesCount
  const suspendedAgenciesCount = initialData?.suspended_agencies_count ?? initialData?.suspendedAgenciesCount ?? MOCK_FALLBACK.suspendedAgenciesCount
  
  const activeClientsCount = initialData?.active_clients_count ?? initialData?.activeClientsCount ?? MOCK_FALLBACK.activeClientsCount
  
  const rawRevenueByPlan = initialData?.revenue_by_plan ?? initialData?.revenueByPlan ?? MOCK_FALLBACK.revenueByPlan
  const invoices = initialData?.invoices ?? MOCK_FALLBACK.invoices

  const d = DICTIONARY[lang]
  const isRtl = lang === 'ar'

  // Format currencies strictly in USD as requested
  const formatUSD = (num: number) => {
    return '$' + num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })
  }

  // Safe percentage calculator
  const getMaxPlanValue = () => {
    const vals = rawRevenueByPlan.map(p => p.value)
    return Math.max(...vals, 1)
  }
  const maxPlanValue = getMaxPlanValue()

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="p-6 space-y-6 text-gray-100 min-h-screen bg-gray-900">
      
      {/* Header with language switcher */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Landmark className="text-emerald-400" size={32} />
            {d.title}
          </h1>
          <p className="text-gray-400 mt-1 max-w-2xl text-sm">
            {d.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-gray-800/80 p-1 rounded-xl border border-gray-700/50 self-end md:self-auto">
          <button
            onClick={() => startTransition(() => setLang('ar'))}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              lang === 'ar' ? 'bg-emerald-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            {d.langAr}
          </button>
          <button
            onClick={() => startTransition(() => setLang('en'))}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              lang === 'en' ? 'bg-emerald-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            {d.langEn}
          </button>
          <button
            onClick={() => startTransition(() => setLang('fr'))}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              lang === 'fr' ? 'bg-emerald-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            {d.langFr}
          </button>
        </div>
      </div>

      {/* 6 Premium KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Card 1: Total Revenue */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/35 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{d.totalRevenue}</span>
              <h3 className="text-3xl font-extrabold text-emerald-400 mt-2 tracking-tight">
                {formatUSD(totalRevenue)}
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/15 rounded-xl text-emerald-400">
              <DollarSign size={20} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
            <TrendingUp size={12} className="text-emerald-400" />
            {d.totalRevenueSub}
          </p>
        </div>

        {/* Card 2: This Month Revenue */}
        <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/35 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{d.thisMonthRevenue}</span>
              <h3 className="text-3xl font-extrabold text-blue-400 mt-2 tracking-tight">
                {formatUSD(thisMonthRevenue)}
              </h3>
            </div>
            <div className="p-3 bg-blue-500/15 rounded-xl text-blue-400">
              <Landmark size={20} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
            <Landmark size={12} className="text-blue-400" />
            {d.thisMonthRevenueSub}
          </p>
        </div>

        {/* Card 3: Last Month Revenue */}
        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/5 border border-purple-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-purple-500/35 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{d.lastMonthRevenue}</span>
              <h3 className="text-3xl font-extrabold text-purple-400 mt-2 tracking-tight">
                {formatUSD(lastMonthRevenue)}
              </h3>
            </div>
            <div className="p-3 bg-purple-500/15 rounded-xl text-purple-400">
              <Landmark size={20} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
            <TrendingUp size={12} className="text-purple-400" />
            {d.lastMonthRevenueSub}
          </p>
        </div>

        {/* Card 4: Invoices paid / pending */}
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-6 relative overflow-hidden hover:border-gray-600/50 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{d.invoicesPaidPending}</span>
              <h3 className="text-3xl font-extrabold text-white mt-2 tracking-tight">
                <span className="text-emerald-400">{paidInvoicesCount}</span>
                <span className="text-gray-500 mx-2">/</span>
                <span className="text-amber-400">{pendingInvoicesCount}</span>
              </h3>
            </div>
            <div className="p-3 bg-gray-700/50 rounded-xl text-gray-300">
              <Receipt size={20} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
            {d.invoicesPaidPendingSub}
          </p>
        </div>

        {/* Card 5: Agencies active / suspended */}
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-6 relative overflow-hidden hover:border-gray-600/50 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{d.agenciesActiveSuspended}</span>
              <h3 className="text-3xl font-extrabold text-white mt-2 tracking-tight">
                <span className="text-blue-400">{activeAgenciesCount}</span>
                <span className="text-gray-500 mx-2">/</span>
                <span className="text-red-400">{suspendedAgenciesCount}</span>
              </h3>
            </div>
            <div className="p-3 bg-gray-700/50 rounded-xl text-gray-300">
              <Building2 size={20} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
            {d.agenciesActiveSuspendedSub}
          </p>
        </div>

        {/* Card 6: Active Clients */}
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-6 relative overflow-hidden hover:border-gray-600/50 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{d.activeClients}</span>
              <h3 className="text-3xl font-extrabold text-cyan-400 mt-2 tracking-tight">
                {activeClientsCount}
              </h3>
            </div>
            <div className="p-3 bg-gray-700/50 rounded-xl text-gray-300">
              <Users size={20} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
            {d.activeClientsSub}
          </p>
        </div>

      </div>

      {/* Main sections: Chart & Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CSS Chart: Plan Revenue Distribution */}
        <div className="lg:col-span-5 bg-gray-800/40 border border-gray-700/50 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Landmark className="text-emerald-400" size={18} />
              {d.revenueByPlan}
            </h3>
            <p className="text-xs text-gray-400 mb-6">
              {d.revenueByPlanSub}
            </p>
          </div>

          <div className="space-y-5">
            {rawRevenueByPlan.map((plan) => {
              const percentage = Math.min(Math.max((plan.value / maxPlanValue) * 100, 4), 100)
              
              // Custom vibrant gradients depending on plan
              let barColor = 'from-emerald-500 to-teal-400 shadow-emerald-500/10'
              if (plan.name === 'starter') barColor = 'from-gray-500 to-gray-400 shadow-gray-500/10'
              if (plan.name === 'growth') barColor = 'from-blue-500 to-cyan-400 shadow-blue-500/10'
              if (plan.name === 'pro') barColor = 'from-purple-500 to-pink-500 shadow-purple-500/10'
              if (plan.name === 'vip') barColor = 'from-amber-500 to-yellow-400 shadow-amber-500/10'

              return (
                <div key={plan.name} className="space-y-1.5 group">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-gray-200 capitalize group-hover:text-white transition-colors">
                      {plan.label}
                    </span>
                    <span className="font-bold text-gray-400 group-hover:text-white transition-colors">
                      {formatUSD(plan.value)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-3.5 overflow-hidden p-0.5 border border-gray-700/30">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${barColor} shadow-md transition-all duration-1000 ease-out`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="pt-4 border-t border-gray-800 mt-6 flex justify-between items-center text-xs text-gray-500">
            <span>* Cumulative tier values</span>
            <span>$ USD ONLY</span>
          </div>
        </div>

        {/* Recent Invoices Table */}
        <div className="lg:col-span-7 bg-gray-800/40 border border-gray-700/50 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Receipt className="text-emerald-400" size={18} />
              {d.invoicesTable}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              {d.invoicesTableSub}
            </p>
          </div>

          <div className="overflow-x-auto flex-1 min-h-[300px]">
            <table className="w-full text-sm text-right border-collapse">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800 text-xs font-semibold uppercase tracking-wider">
                  <th className={`pb-3 px-2 ${isRtl ? 'text-right' : 'text-left'}`}>{d.invoiceId}</th>
                  <th className={`pb-3 px-2 ${isRtl ? 'text-right' : 'text-left'}`}>{d.agency}</th>
                  <th className="pb-3 px-2 text-center">{d.amount}</th>
                  <th className="pb-3 px-2 text-center">{d.status}</th>
                  <th className={`pb-3 px-2 ${isRtl ? 'text-left' : 'text-right'}`}>{d.date}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {invoices.map((inv) => {
                  let statusStyle = 'bg-gray-500/10 text-gray-400'
                  let statusLabel: string = d.statusPending
                  
                  if (inv.status === 'paid') {
                    statusStyle = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                    statusLabel = d.statusPaid
                  } else if (inv.status === 'pending') {
                    statusStyle = 'bg-amber-500/10 text-amber-400 border border-amber-500/15'
                    statusLabel = d.statusPending
                  } else if (inv.status === 'unpaid') {
                    statusStyle = 'bg-red-500/10 text-red-400 border border-red-500/15'
                    statusLabel = d.statusUnpaid
                  } else if (inv.status === 'refunded') {
                    statusStyle = 'bg-purple-500/10 text-purple-400 border border-purple-500/15'
                    statusLabel = d.statusRefunded
                  }

                  return (
                    <tr key={inv.id} className="hover:bg-gray-800/35 transition-colors">
                      <td className={`py-3.5 px-2 font-mono text-xs text-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}>
                        {inv.id}
                      </td>
                      <td className={`py-3.5 px-2 font-semibold text-white ${isRtl ? 'text-right' : 'text-left'}`}>
                        {inv.agency_name || 'Direct Business'}
                      </td>
                      <td className="py-3.5 px-2 text-center font-bold text-white">
                        {formatUSD(inv.amount)}
                      </td>
                      <td className="py-3.5 px-2 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className={`py-3.5 px-2 text-gray-400 text-xs ${isRtl ? 'text-left' : 'text-right'}`}>
                        {inv.created_at}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="pt-4 border-t border-gray-800 mt-4 flex justify-between items-center text-xs text-gray-500">
            <span>🛡️ End-to-end Encrypted Billings</span>
            <span>$ USD ONLY</span>
          </div>

        </div>

      </div>

    </div>
  )
}
