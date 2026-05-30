'use client'

import React, { useState, useTransition, useEffect } from 'react'
import {
  DollarSign, TrendingUp, TrendingDown,
  Building2, Users, Receipt, AlertCircle,
  TrendingUp as ProfitIcon, Landmark, RefreshCw,
  Calendar, ShieldCheck, Filter, Award
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, BarChart, Bar, Legend, Cell
} from 'recharts'

// Dictionary type definition
type Lang = 'ar' | 'en' | 'fr'

interface Invoice {
  id: string
  invoice_number?: string
  amount: number
  currency: string
  status: 'paid' | 'pending' | 'unpaid' | 'refunded'
  invoice_type?: string
  plan_type?: string
  created_at: string
  paid_at?: string | null
  tenant_id?: string | null
  agency_id?: string | null
  tenants?: { name: string } | null
  agencies?: { name: string } | null
}

interface Agency {
  id: string
  name: string
  plan_type: string
  created_at: string
  subscription_status: string
}

interface Plan {
  name: string
  price_monthly?: number
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
  invoices?: Invoice[]
  agencies?: Agency[]
  plans?: Plan[]
}

const DICTIONARY = {
  ar: {
    title: 'التحليل المالي والتقارير الشاملة',
    subtitle: 'مراقبة إيرادات المنصة، الاشتراكات، والتحليلات البيانية المتقدمة للوكالات والعملاء المباشرين.',
    totalRevenue: 'إجمالي الإيرادات التراكمية',
    totalRevenueSub: 'تراكمي المنصة بالكامل',
    thisMonthRevenue: 'إيرادات هذا الشهر',
    thisMonthRevenueSub: 'مجموع المدفوعات في الشهر الحالي',
    lastMonthRevenue: 'إيرادات الشهر الماضي',
    lastMonthRevenueSub: 'أداء الشهر المنقضي',
    invoicesPaidPending: 'الفواتير (المدفوعة / المعلقة)',
    invoicesPaidPendingSub: 'توزيع فواتير المنصة الحالية',
    agenciesActiveSuspended: 'الوكالات (نشطة / موقوفة)',
    agenciesActiveSuspendedSub: 'حالة اشتراكات الوكالات الشريكة',
    activeClients: 'العملاء المباشرين النشطين',
    activeClientsSub: 'الأعمال المستقلة المشتركة بالمنصة',
    
    // New KPIs
    mrr: 'العائد الشهري المتكرر (MRR)',
    mrrSub: 'إجمالي الاشتراكات النشطة شهرياً',
    arr: 'العائد السنوي المتكرر (ARR)',
    arrSub: 'تقدير الإيراد السنوي المتوقع',
    arpa: 'متوسط الإيراد لكل وكالة (ARPA)',
    arpaSub: 'إجمالي الإيرادات ÷ عدد الوكالات',

    revenueByPlan: 'توزيع الإيرادات حسب الباقة',
    revenueByPlanSub: 'تحليل الإيرادات التراكمية لكل فئة اشتراك',
    invoicesTable: 'جدول الفواتير التفصيلي',
    invoicesTableSub: 'تتبع آخر عمليات الفوترة وتحديثات السداد والفلاتر النشطة',
    invoiceId: 'معرف الفاتورة',
    invoiceNo: 'رقم الفاتورة 📄',
    invoiceType: 'نوع الفاتورة',
    agency: 'المستفيد (الوكالة / العميل)',
    amount: 'المبلغ',
    status: 'الحالة',
    date: 'تاريخ الإنشاء',
    statusPaid: 'مدفوعة',
    statusPending: 'قيد الانتظار',
    statusUnpaid: 'غير مدفوعة',
    statusRefunded: 'مسترجعة',
    filterAll: 'الكل',
    langAr: 'العربية',
    langEn: 'English',
    langFr: 'Français',
    noInvoices: 'لا توجد فواتير مطابقة لخيارات التصفية حالياً.',
    directTenant: 'عميل مباشر 👤',
    unknown: 'غير معروف',

    // Filters
    filterStatus: 'تصفية بالحالة',
    filterDate: 'نطاق التاريخ',
    filterAgency: 'تصفية حسب الوكالة',
    thisMonth: 'الشهر الحالي',
    lastMonth: 'الشهر الماضي',
    allTime: 'كل الوقت',

    // Charts
    chartMRRTitle: 'إيرادات الـ MRR التاريخية - آخر 12 شهر',
    chartMRRSub: 'توزيع المدفوعات والاشتراكات الفعلية شهرياً',
    chartGrowthTitle: 'منحنى تزايد ونمو الوكالات الشريكة',
    chartGrowthSub: 'معدل الانضمام التراكمي للشركاء والموزعين',
    chartTopAgenciesTitle: 'أعلى 5 وكالات شريكة تحقيقاً للإيرادات',
    chartTopAgenciesSub: 'توزيع إجمالي الإيرادات التراكمية لكل شريك'
  },
  en: {
    title: 'Financial Analysis & Advanced Reports',
    subtitle: 'Monitor platform revenues, subscriptions, KPIs, and visual charts across agencies and direct clients.',
    totalRevenue: 'Total Cumulative Revenue',
    totalRevenueSub: 'Accumulative platform revenue',
    thisMonthRevenue: 'This Month Revenue',
    thisMonthRevenueSub: 'Paid invoices in the current month',
    lastMonthRevenue: 'Last Month Revenue',
    lastMonthRevenueSub: 'Performance of the previous month',
    invoicesPaidPending: 'Invoices (Paid / Pending)',
    invoicesPaidPendingSub: 'Distribution of current invoices',
    agenciesActiveSuspended: 'Agencies (Active / Suspended)',
    agenciesActiveSuspendedSub: 'Status of agency subscriptions',
    activeClients: 'Active Direct Tenants',
    activeClientsSub: 'Direct subscribed businesses',

    // New KPIs
    mrr: 'Monthly Recurring Revenue (MRR)',
    mrrSub: 'Total active monthly subscriptions',
    arr: 'Annual Recurring Revenue (ARR)',
    arrSub: 'Projected annual revenue estimate',
    arpa: 'Avg Revenue Per Agency (ARPA)',
    arpaSub: 'Total revenue ÷ active agencies count',

    revenueByPlan: 'Revenue by Subscription Plan',
    revenueByPlanSub: 'Cumulative revenue analysis for each tier',
    invoicesTable: 'Detailed Invoices Ledger',
    invoicesTableSub: 'Track latest billing processes, payments, and active filters',
    invoiceId: 'Invoice ID',
    invoiceNo: 'Invoice No 📄',
    invoiceType: 'Invoice Type',
    agency: 'Recipient (Agency / Client)',
    amount: 'Amount',
    status: 'Status',
    date: 'Date Created',
    statusPaid: 'Paid',
    statusPending: 'Pending',
    statusUnpaid: 'Unpaid',
    statusRefunded: 'Refunded',
    filterAll: 'All',
    langAr: 'العربية',
    langEn: 'English',
    langFr: 'Français',
    noInvoices: 'No invoices match your filter criteria.',
    directTenant: 'Direct Tenant 👤',
    unknown: 'Unknown',

    // Filters
    filterStatus: 'Filter by Status',
    filterDate: 'Date Range',
    filterAgency: 'Filter by Agency',
    thisMonth: 'This Month',
    lastMonth: 'Last Month',
    allTime: 'All Time',

    // Charts
    chartMRRTitle: 'Historical MRR Revenue - Last 12 Months',
    chartMRRSub: 'Distribution of actual subscription payments by month',
    chartGrowthTitle: 'Cumulative Partner Agencies Growth Curve',
    chartGrowthSub: 'Cumulative tracking of resellers and partners signing up',
    chartTopAgenciesTitle: 'Top 5 Revenue Generating Partner Agencies',
    chartTopAgenciesSub: 'Distribution of cumulative billing and payments per partner'
  },
  fr: {
    title: 'Analyse Financière & Rapports Avancés',
    subtitle: 'Supervisez les revenus, les KPIs et les graphiques de la plateforme pour les agences et clients directs.',
    totalRevenue: 'Revenu Cumulé Total',
    totalRevenueSub: 'Revenu cumulatif de la plateforme',
    thisMonthRevenue: 'Revenu de ce Mois',
    thisMonthRevenueSub: 'Factures payées ce mois-ci',
    lastMonthRevenue: 'Revenu du Mois Dernier',
    lastMonthRevenueSub: 'Performance du mois précédent',
    invoicesPaidPending: 'Factures (Payées / En attente)',
    invoicesPaidPendingSub: 'Distribution des factures actuelles',
    agenciesActiveSuspended: 'Agences (Actives / Suspendues)',
    agenciesActiveSuspendedSub: 'Statut des abonnements d\'agences',
    activeClients: 'Clients Directs Actifs',
    activeClientsSub: 'Entreprises en direct activement abonnées',

    // New KPIs
    mrr: 'Revenu Récurrent Mensuel (MRR)',
    mrrSub: 'Total des abonnements mensuels actifs',
    arr: 'Revenu Récurrent Annuel (ARR)',
    arrSub: 'Estimation du revenu annuel projeté',
    arpa: 'Revenu Moyen Par Agence (ARPA)',
    arpaSub: 'Revenu total ÷ nombre d\'agences',

    revenueByPlan: 'Revenu par Plan d\'Abonnement',
    revenueByPlanSub: 'Analyse des revenus cumulés pour chaque niveau',
    invoicesTable: 'Grand Livre des Factures',
    invoicesTableSub: 'Suivi des derniers paiements et filtres actifs',
    invoiceId: 'ID de facture',
    invoiceNo: 'N° de Facture 📄',
    invoiceType: 'Type de Facture',
    agency: 'Bénéficiaire (Agence / Client)',
    amount: 'Montant',
    status: 'Statut',
    date: 'Date de Création',
    statusPaid: 'Payé',
    statusPending: 'En attente',
    statusUnpaid: 'Non payé',
    statusRefunded: 'Remboursé',
    filterAll: 'Tout',
    langAr: 'العربية',
    langEn: 'English',
    langFr: 'Français',
    noInvoices: 'Aucune facture ne correspond à vos critères.',
    directTenant: 'Client Direct 👤',
    unknown: 'Inconnu',

    // Filters
    filterStatus: 'Filtrer par Statut',
    filterDate: 'Période',
    filterAgency: 'Filtrer par Agence',
    thisMonth: 'Ce Mois',
    lastMonth: 'Le Mois Dernier',
    allTime: 'Tout le Temps',

    // Charts
    chartMRRTitle: 'Revenus MRR Historiques - 12 Derniers Mois',
    chartMRRSub: 'Distribution mensuelle des abonnements payés',
    chartGrowthTitle: 'Courbe de Croissance Cumulative des Agences',
    chartGrowthSub: 'Suivi cumulatif des inscriptions de partenaires revendeurs',
    chartTopAgenciesTitle: 'Top 5 des Agences Partenaires par Revenu',
    chartTopAgenciesSub: 'Distribution de la facturation cumulative par partenaire'
  }
} as const

export function FinanceUI({ initialData, invoices = [], agencies = [], plans = [] }: FinanceUIProps) {
  const [lang, setLang] = useState<Lang>('ar')
  const [isPending, startTransition] = useTransition()
  const [mounted, setMounted] = useState(false)

  // Filters state
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [agencyFilter, setAgencyFilter] = useState<string>('all')

  useEffect(() => {
    setMounted(true)
  }, [])

  const safeInvoices = Array.isArray(invoices) ? invoices : []
  const safeAgencies = Array.isArray(agencies) ? agencies : []
  const safePlans = Array.isArray(plans) ? plans : []

  // Dynamic KPI Calculations
  const calculatedTotalRevenue = safeInvoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0)

  // MRR: Sum of paid invoices in the current calendar month
  const getMRR = () => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-11
    
    return safeInvoices
      .filter(inv => {
        if (inv.status !== 'paid') return false
        const date = new Date(inv.paid_at || inv.created_at)
        return date.getFullYear() === currentYear && date.getMonth() === currentMonth
      })
      .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0)
  }

  const calculatedMRR = getMRR()
  const calculatedARR = calculatedMRR * 12
  const calculatedARPA = safeAgencies.length > 0 ? calculatedTotalRevenue / safeAgencies.length : 0

  // Standard platform metrics from initialData or calculated as a fallback
  const totalRevenue = initialData?.total_revenue ?? initialData?.totalRevenue ?? calculatedTotalRevenue
  const thisMonthRevenue = initialData?.this_month_revenue ?? initialData?.thisMonthRevenue ?? calculatedMRR
  const lastMonthRevenue = initialData?.last_month_revenue ?? initialData?.lastMonthRevenue ?? 0
  
  const paidInvoicesCount = initialData?.paid_invoices_count ?? initialData?.paidInvoicesCount ?? safeInvoices.filter(i => i.status === 'paid').length
  const pendingInvoicesCount = initialData?.pending_invoices_count ?? initialData?.pendingInvoicesCount ?? safeInvoices.filter(i => i.status === 'pending').length
  
  const activeAgenciesCount = initialData?.active_agencies_count ?? initialData?.activeAgenciesCount ?? safeAgencies.length
  const suspendedAgenciesCount = initialData?.suspended_agencies_count ?? initialData?.suspendedAgenciesCount ?? 0
  const activeClientsCount = initialData?.active_clients_count ?? initialData?.activeClientsCount ?? 0
  
  // Dynamic Plan Revenue Calculation (completely automatic when a plan is deleted or added)
  const getDynamicRevenueByPlan = () => {
    const planMap: Record<string, number> = {}
    
    // 1. Initialize all active plans from database plans table with 0 revenue
    safePlans.forEach(p => {
      planMap[p.name.toLowerCase()] = 0
    })
    
    // 2. Sum paid invoices revenue grouped by plan_type
    safeInvoices.forEach(inv => {
      if (inv.status !== 'paid') return
      const planName = (inv.plan_type || 'unassigned').toLowerCase()
      planMap[planName] = (planMap[planName] || 0) + (Number(inv.amount) || 0)
    })
    
    // If safePlans is empty (fallback to protect initial layout), populate the 4 default ones
    if (safePlans.length === 0) {
      const corePlans = ['starter', 'growth', 'pro', 'vip']
      corePlans.forEach(cp => {
        if (!(cp in planMap)) {
          planMap[cp] = 0
        }
      })
    }

    return Object.entries(planMap).map(([name, value]) => {
      // Look up plan in the database plans array
      const dbPlan = safePlans.find(p => p.name.toLowerCase() === name)
      const price = dbPlan?.price_monthly
      
      let label = dbPlan
        ? `${dbPlan.name} ($${price})`
        : name.charAt(0).toUpperCase() + name.slice(1)
        
      // Keep beautiful labels for default tiers
      if (name === 'starter' && !dbPlan) label = 'Starter ($49)'
      else if (name === 'growth' && !dbPlan) label = 'Growth ($99)'
      else if (name === 'pro' && !dbPlan) label = 'Pro ($199)'
      else if (name === 'vip' && !dbPlan) label = 'VIP ($399)'
      
      return {
        name,
        label,
        value
      }
    }).sort((a, b) => b.value - a.value)
  }

  const rawRevenueByPlan = getDynamicRevenueByPlan()

  const d = DICTIONARY[lang]
  const isRtl = lang === 'ar'

  // Format currencies strictly in USD as requested
  const formatUSD = (num: number) => {
    return '$' + num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })
  }

  // Safe percentage calculator for plans
  const getMaxPlanValue = () => {
    const vals = rawRevenueByPlan.map(p => p.value)
    return Math.max(...vals, 1)
  }
  const maxPlanValue = getMaxPlanValue()

  // Filter invoices logic
  const filteredInvoices = safeInvoices.filter(inv => {
    const matchesStatus = statusFilter === 'all' ? true : inv.status === statusFilter
    
    let matchesDate = true
    if (dateFilter !== 'all') {
      const now = new Date()
      const invDate = new Date(inv.created_at)
      if (dateFilter === 'this_month') {
        matchesDate = invDate.getFullYear() === now.getFullYear() && invDate.getMonth() === now.getMonth()
      } else if (dateFilter === 'last_month') {
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
        const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
        matchesDate = invDate.getFullYear() === lastMonthYear && invDate.getMonth() === lastMonth
      }
    }
    
    const matchesAgency = agencyFilter === 'all' ? true : inv.agency_id === agencyFilter
    return matchesStatus && matchesDate && matchesAgency
  })

  // Dynamic Recharts Data Aggregation

  // 1. Last 12 months MRR history data
  const getMRRHistoryData = () => {
    const data = []
    const now = new Date()
    
    for (let i = 11; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = targetDate.getFullYear()
      const month = targetDate.getMonth()
      
      const monthLabel = targetDate.toLocaleString(lang === 'ar' ? 'ar-EG' : lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', year: '2-digit' })
      
      const monthlyRevenue = safeInvoices
        .filter(inv => {
          if (inv.status !== 'paid') return false
          const date = new Date(inv.paid_at || inv.created_at)
          return date.getFullYear() === year && date.getMonth() === month
        })
        .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0)
        
      data.push({
        name: monthLabel,
        mrr: monthlyRevenue
      })
    }
    return data
  }
  const mrrHistoryData = getMRRHistoryData()

  // 2. Cumulative Agencies signup growth data
  const getAgenciesGrowthData = () => {
    const data = []
    const sortedAgencies = [...safeAgencies].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    
    let cumulativeCount = 0
    const monthlyCounts: Record<string, number> = {}
    
    sortedAgencies.forEach(agency => {
      const date = new Date(agency.created_at)
      const label = date.toLocaleString(lang === 'ar' ? 'ar-EG' : lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', year: '2-digit' })
      monthlyCounts[label] = (monthlyCounts[label] || 0) + 1
    })
    
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = targetDate.toLocaleString(lang === 'ar' ? 'ar-EG' : lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', year: '2-digit' })
      
      cumulativeCount += (monthlyCounts[label] || 0)
      
      data.push({
        name: label,
        agencies: cumulativeCount
      })
    }
    return data
  }
  const agenciesGrowthData = getAgenciesGrowthData()

  // 3. Top 5 generating partner agencies
  const getTopAgenciesData = () => {
    const agencyRevenueMap: Record<string, number> = {}
    
    safeInvoices.forEach(inv => {
      if (inv.status !== 'paid' || !inv.agency_id) return
      agencyRevenueMap[inv.agency_id] = (agencyRevenueMap[inv.agency_id] || 0) + (Number(inv.amount) || 0)
    })
    
    const mappedData = Object.entries(agencyRevenueMap).map(([id, rev]) => {
      const agency = safeAgencies.find(a => a.id === id)
      return {
        name: agency ? agency.name : (lang === 'ar' ? 'وكالة شريكة' : 'Partner Agency'),
        revenue: rev
      }
    })
    
    return mappedData.sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  }
  const topAgenciesData = getTopAgenciesData()

  const getRecipientName = (inv: Invoice) => {
    if (inv.agencies?.name) return inv.agencies.name
    if (inv.tenants?.name) return `${inv.tenants.name} (${d.directTenant})`
    return d.directTenant
  }

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

      {/* 9 Premium KPI Cards Grid */}
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

        {/* New Card 4: MRR */}
        <div className="bg-gradient-to-br from-teal-500/10 to-emerald-500/5 border border-teal-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-teal-500/35 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{d.mrr}</span>
              <h3 className="text-3xl font-extrabold text-teal-400 mt-2 tracking-tight">
                {formatUSD(calculatedMRR)}
              </h3>
            </div>
            <div className="p-3 bg-teal-500/15 rounded-xl text-teal-400">
              <RefreshCw size={20} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
            <Calendar size={12} className="text-teal-400" />
            {d.mrrSub}
          </p>
        </div>

        {/* New Card 5: ARR */}
        <div className="bg-gradient-to-br from-indigo-500/10 to-blue-500/5 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-indigo-500/35 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{d.arr}</span>
              <h3 className="text-3xl font-extrabold text-indigo-400 mt-2 tracking-tight">
                {formatUSD(calculatedARR)}
              </h3>
            </div>
            <div className="p-3 bg-indigo-500/15 rounded-xl text-indigo-400">
              <TrendingUp size={20} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
            <ShieldCheck size={12} className="text-indigo-400" />
            {d.arrSub}
          </p>
        </div>

        {/* New Card 6: ARPA */}
        <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border border-amber-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-amber-500/35 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{d.arpa}</span>
              <h3 className="text-3xl font-extrabold text-amber-400 mt-2 tracking-tight">
                {formatUSD(calculatedARPA)}
              </h3>
            </div>
            <div className="p-3 bg-amber-500/15 rounded-xl text-amber-400">
              <Users size={20} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
            <Award size={12} className="text-amber-400" />
            {d.arpaSub}
          </p>
        </div>

        {/* Card 7: Invoices paid / pending */}
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

        {/* Card 8: Agencies active / suspended */}
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

        {/* Card 9: Active Clients */}
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

      {/* Interactive Charts Dashboard Block */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Historical MRR Area Chart */}
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <TrendingUp className="text-emerald-400" size={18} />
              {d.chartMRRTitle}
            </h3>
            <p className="text-xs text-gray-400 mb-6">
              {d.chartMRRSub}
            </p>
          </div>

          <div className="w-full flex-1">
            {mounted ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={mrrHistoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMRR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="mrr" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorMRR)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-gray-500 text-sm">
                Loading charts...
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Cumulative Partner Agencies signup curve */}
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Building2 className="text-blue-400" size={18} />
              {d.chartGrowthTitle}
            </h3>
            <p className="text-xs text-gray-400 mb-6">
              {d.chartGrowthSub}
            </p>
          </div>

          <div className="w-full flex-1">
            {mounted ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={agenciesGrowthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Line type="monotone" dataKey="agencies" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#0f172a' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-gray-500 text-sm">
                Loading charts...
              </div>
            )}
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CSS Chart: Plan Revenue & Recharts Top 5 Bar Chart */}
        <div className="lg:col-span-5 space-y-6 flex flex-col">
          
          {/* Recharts Chart 3: Top 5 Generating Agencies Bar Chart */}
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-6 flex flex-col justify-between flex-1">
            <div>
              <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <Award className="text-purple-400" size={18} />
                {d.chartTopAgenciesTitle}
              </h3>
              <p className="text-xs text-gray-400 mb-6">
                {d.chartTopAgenciesSub}
              </p>
            </div>

            <div className="w-full flex-1">
              {mounted ? (
                topAgenciesData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={topAgenciesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="revenue" fill="#8b5cf6" radius={[6, 6, 0, 0]}>
                        {topAgenciesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#8b5cf6', '#6366f1', '#4f46e5', '#4338ca', '#3730a3'][index % 5]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-500 text-sm">
                    {d.noInvoices}
                  </div>
                )
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-500 text-sm">
                  Loading charts...
                </div>
              )}
            </div>
          </div>

          {/* Original Plan Revenue Distribution */}
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <Landmark className="text-emerald-400" size={18} />
                {d.revenueByPlan}
              </h3>
              <p className="text-xs text-gray-400 mb-6">
                {d.revenueByPlanSub}
              </p>
            </div>

            <div className="space-y-4">
              {rawRevenueByPlan.map((plan) => {
                const percentage = Math.min(Math.max((plan.value / maxPlanValue) * 100, 4), 100)
                
                let barColor = 'from-emerald-500 to-teal-400 shadow-emerald-500/10'
                if (plan.name === 'starter') barColor = 'from-gray-500 to-gray-400 shadow-gray-500/10'
                if (plan.name === 'growth') barColor = 'from-blue-500 to-cyan-400 shadow-blue-500/10'
                if (plan.name === 'pro') barColor = 'from-purple-500 to-pink-500 shadow-purple-500/10'
                if (plan.name === 'vip') barColor = 'from-amber-500 to-yellow-400 shadow-amber-500/10'

                return (
                  <div key={plan.name} className="space-y-1 group">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-gray-200 capitalize group-hover:text-white transition-colors">
                        {plan.label}
                      </span>
                      <span className="font-bold text-gray-400 group-hover:text-white transition-colors">
                        {formatUSD(plan.value)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden p-0.5 border border-gray-700/30">
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

        </div>

        {/* Recent Invoices Table with Advanced Filters */}
        <div className="lg:col-span-7 bg-gray-800/40 border border-gray-700/50 rounded-2xl p-6 flex flex-col justify-between">
          
          {/* Header block with Filters */}
          <div className="space-y-4 mb-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  <Receipt className="text-emerald-400" size={18} />
                  {d.invoicesTable}
                </h3>
                <p className="text-xs text-gray-400">
                  {d.invoicesTableSub}
                </p>
              </div>
            </div>

            {/* Filter controls row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-gray-900/50 rounded-xl border border-gray-800/50">
              
              {/* Filter by Status */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center gap-1">
                  <Filter size={10} />
                  {d.filterStatus}
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700/50 text-gray-200 rounded-lg p-2 text-xs outline-none cursor-pointer hover:border-emerald-500/50 transition-colors"
                >
                  <option value="all">{d.filterAll}</option>
                  <option value="paid">{d.statusPaid}</option>
                  <option value="pending">{d.statusPending}</option>
                  <option value="unpaid">{d.statusUnpaid}</option>
                  <option value="refunded">{d.statusRefunded}</option>
                </select>
              </div>

              {/* Filter by Date Range */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center gap-1">
                  <Calendar size={10} />
                  {d.filterDate}
                </label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700/50 text-gray-200 rounded-lg p-2 text-xs outline-none cursor-pointer hover:border-emerald-500/50 transition-colors"
                >
                  <option value="all">{d.filterAll}</option>
                  <option value="this_month">{d.thisMonth}</option>
                  <option value="last_month">{d.lastMonth}</option>
                </select>
              </div>

              {/* Filter by Agency */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center gap-1">
                  <Building2 size={10} />
                  {d.filterAgency}
                </label>
                <select
                  value={agencyFilter}
                  onChange={(e) => setAgencyFilter(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700/50 text-gray-200 rounded-lg p-2 text-xs outline-none cursor-pointer hover:border-emerald-500/50 transition-colors"
                >
                  <option value="all">{d.filterAll}</option>
                  {safeAgencies.map(agency => (
                    <option key={agency.id} value={agency.id}>{agency.name}</option>
                  ))}
                </select>
              </div>

            </div>
          </div>

          <div className="overflow-x-auto flex-1 min-h-[300px]">
            <table className="w-full text-sm text-right border-collapse">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800 text-[11px] font-semibold uppercase tracking-wider">
                  <th className={`pb-3 px-2 ${isRtl ? 'text-right' : 'text-left'}`}>{d.invoiceNo}</th>
                  <th className={`pb-3 px-2 ${isRtl ? 'text-right' : 'text-left'}`}>{d.agency}</th>
                  <th className="pb-3 px-2 text-center">{d.invoiceType}</th>
                  <th className="pb-3 px-2 text-center">{d.amount}</th>
                  <th className="pb-3 px-2 text-center">{d.status}</th>
                  <th className={`pb-3 px-2 ${isRtl ? 'text-left' : 'text-right'}`}>{d.date}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-24 text-center text-gray-500 text-sm font-medium">
                      {d.noInvoices}
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
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

                    // Format dates safely
                    const formattedDate = new Date(inv.created_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })

                    return (
                      <tr key={inv.id} className="hover:bg-gray-800/35 transition-colors">
                        <td className={`py-3 px-2 font-mono text-[11px] font-bold text-emerald-400 ${isRtl ? 'text-right' : 'text-left'}`}>
                          {inv.invoice_number || `INV-${inv.id.substring(0, 8).toUpperCase()}`}
                        </td>
                        <td className={`py-3 px-2 font-semibold text-white ${isRtl ? 'text-right' : 'text-left'}`}>
                          {getRecipientName(inv)}
                        </td>
                        <td className="py-3 px-2 text-center text-xs font-semibold text-gray-400 capitalize">
                          {inv.invoice_type || 'subscription'}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-white">
                          {formatUSD(inv.amount)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusStyle}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className={`py-3 px-2 text-gray-400 text-xs ${isRtl ? 'text-left' : 'text-right'}`}>
                          {formattedDate}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-4 border-t border-gray-800 mt-4 flex justify-between items-center text-xs text-gray-500">
            <span>🛡️ End-to-end Encrypted Platform Billings</span>
            <span>$ USD ONLY</span>
          </div>

        </div>

      </div>

    </div>
  )
}
