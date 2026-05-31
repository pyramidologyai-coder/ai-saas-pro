'use client'

import React, { useState, useTransition, useEffect, useRef } from 'react'
import {
  DollarSign, TrendingUp, TrendingDown,
  Building2, Users, Receipt, AlertCircle,
  Landmark, RefreshCw, Calendar, ShieldCheck,
  Filter, Award, Search, ChevronDown
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, BarChart, Bar, Cell
} from 'recharts'

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

interface Tenant {
  id: string
  name: string
  created_at?: string
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
  tenants?: Tenant[]
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
    filterStatus: 'تصفية بالحالة',
    filterDate: 'نطاق التاريخ',
    filterAgency: 'تصفية حسب الوكالة',
    thisMonth: 'الشهر الحالي',
    lastMonth: 'الشهر الماضي',
    allTime: 'كل الوقت',
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
    filterStatus: 'Filter by Status',
    filterDate: 'Date Range',
    filterAgency: 'Filter by Agency',
    thisMonth: 'This Month',
    lastMonth: 'Last Month',
    allTime: 'All Time',
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
    filterStatus: 'Filtrer par Statut',
    filterDate: 'Période',
    filterAgency: 'Filtrer par Agence',
    thisMonth: 'Ce Mois',
    lastMonth: 'Le Mois Dernier',
    allTime: 'Tout le Temps',
    chartMRRTitle: 'Revenus MRR Historiques - 12 Derniers Mois',
    chartMRRSub: 'Distribution mensuelle des abonnements payés',
    chartGrowthTitle: 'Courbe de Croissance Cumulative des Agences',
    chartGrowthSub: 'Suivi cumulatif des inscriptions de partenaires revendeurs',
    chartTopAgenciesTitle: 'Top 5 des Agences Partenaires par Revenu',
    chartTopAgenciesSub: 'Distribution de la facturation cumulative par partenaire'
  }
} as const

export function FinanceUI({ initialData, invoices = [], agencies = [], plans = [], tenants = [] }: FinanceUIProps) {
  const [lang, setLang] = useState<Lang>('ar')
  const [isPending, startTransition] = useTransition()
  const [mounted, setMounted] = useState(false)

  // Filters state
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [beneficiarySearch, setBeneficiarySearch] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Searchable Beneficiary Select state
  const [recipientDropdownOpen, setRecipientDropdownOpen] = useState(false)
  const [recipientSearchQuery, setRecipientSearchQuery] = useState('')
  const [selectedRecipient, setSelectedRecipient] = useState<{ id: string; name: string; type: 'agency' | 'tenant' } | null>(null)
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null)
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null)
  
  const recipientDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    
    function handleClickOutside(event: MouseEvent) {
      if (recipientDropdownRef.current && !recipientDropdownRef.current.contains(event.target as Node)) {
        setRecipientDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [])

  const safeInvoices = Array.isArray(invoices) ? invoices : []
  const safeAgencies = Array.isArray(agencies) ? agencies : []
  const safePlans = Array.isArray(plans) ? plans : []
  const safeTenants = Array.isArray(tenants) ? tenants : []
  const directClients = safeTenants

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
      } else if (dateFilter === 'last_6_months') {
        const sixMonthsAgo = new Date()
        sixMonthsAgo.setMonth(now.getMonth() - 6)
        matchesDate = invDate >= sixMonthsAgo
      } else if (dateFilter === 'last_year') {
        const oneYearAgo = new Date()
        oneYearAgo.setFullYear(now.getFullYear() - 1)
        matchesDate = invDate >= oneYearAgo
      } else if (dateFilter === 'custom') {
        const start = startDate ? new Date(startDate) : null
        const end = endDate ? new Date(endDate) : null
        
        if (start && end) {
          start.setHours(0, 0, 0, 0)
          const endOfDay = new Date(end)
          endOfDay.setHours(23, 59, 59, 999)
          matchesDate = invDate >= start && invDate <= endOfDay
        } else if (start) {
          start.setHours(0, 0, 0, 0)
          matchesDate = invDate >= start
        } else if (end) {
          const endOfDay = new Date(end)
          endOfDay.setHours(23, 59, 59, 999)
          matchesDate = invDate <= endOfDay
        }
      }
    }
    
    // Filter by Searchable Recipient selection (Agencies & Direct Clients)
    let matchesRecipient = true
    if (selectedRecipient) {
      if (selectedRecipient.type === 'agency') {
        matchesRecipient = inv.agency_id === selectedRecipient.id
      } else {
        matchesRecipient = inv.tenant_id === selectedRecipient.id
      }
    } else if (selectedAgencyId) {
      matchesRecipient = inv.agency_id === selectedAgencyId
    } else if (selectedTenantId) {
      matchesRecipient = inv.tenant_id === selectedTenantId
    }
    
    return matchesStatus && matchesDate && matchesRecipient
  })

  // Dynamic KPI Calculations
  const calculatedTotalRevenue = filteredInvoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0)

  // MRR: Sum of paid invoices in the current calendar month
  const getMRR = () => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-11
    
    return filteredInvoices
      .filter(inv => {
        if (inv.status !== 'paid') return false
        const date = new Date(inv.paid_at || inv.created_at)
        return date.getFullYear() === currentYear && date.getMonth() === currentMonth
      })
      .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0)
  }

  const calculatedMRR = getMRR()
  const calculatedARR = calculatedMRR * 12

  const filteredAgencyCount = new Set(
    filteredInvoices
      .filter(inv => inv.agency_id)
      .map(inv => inv.agency_id)
  ).size || safeAgencies.length

  const calculatedARPA = filteredAgencyCount > 0 
    ? calculatedTotalRevenue / filteredAgencyCount : 0

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

  const getUniqueRecipients = () => {
    const list: Array<{ id: string; name: string; type: 'agency' | 'tenant' }> = []
    const seen = new Set<string>()

    // 1. Add all safeAgencies from the prop
    safeAgencies.forEach(a => {
      if (!seen.has(a.id)) {
        seen.add(a.id)
        list.push({ id: a.id, name: a.name, type: 'agency' })
      }
    })

    // 2. Add all safeTenants from the prop
    safeTenants.forEach(t => {
      if (!seen.has(t.id)) {
        seen.add(t.id)
        list.push({ id: t.id, name: t.name, type: 'tenant' })
      }
    })

    // 3. Add all unique agencies or direct tenants from invoices
    safeInvoices.forEach(inv => {
      if (inv.agency_id && inv.agencies?.name) {
        if (!seen.has(inv.agency_id)) {
          seen.add(inv.agency_id)
          list.push({ id: inv.agency_id, name: inv.agencies.name, type: 'agency' })
        }
      } else if (inv.tenant_id && inv.tenants?.name) {
        if (!seen.has(inv.tenant_id)) {
          seen.add(inv.tenant_id)
          list.push({ id: inv.tenant_id, name: inv.tenants.name, type: 'tenant' })
        }
      }
    })

    return list
  }
  const uniqueRecipients = getUniqueRecipients()

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="p-6 space-y-6 min-h-screen text-[var(--text-main)] bg-[var(--bg-color)]">
      
      {/* Header with language switcher */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-[var(--glass-border)]">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-main)] flex items-center gap-3">
            <Landmark className="text-[var(--accent-primary)]" size={32} />
            {d.title}
          </h1>
          <p className="text-[var(--text-dim)] mt-1 max-w-2xl text-sm">
            {d.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[var(--bg-input)] p-1 rounded-xl border border-[var(--glass-border)] self-end md:self-auto">
          <button
            onClick={() => startTransition(() => setLang('ar'))}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              lang === 'ar' ? 'bg-[var(--accent-primary)] text-white shadow-lg' : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
            }`}
          >
            {d.langAr}
          </button>
          <button
            onClick={() => startTransition(() => setLang('en'))}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              lang === 'en' ? 'bg-[var(--accent-primary)] text-white shadow-lg' : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
            }`}
          >
            {d.langEn}
          </button>
          <button
            onClick={() => startTransition(() => setLang('fr'))}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              lang === 'fr' ? 'bg-[var(--accent-primary)] text-white shadow-lg' : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
            }`}
          >
            {d.langFr}
          </button>
        </div>
      </div>

      {/* Premium Top Filter Bar (مستطيل التصفية الأفقي الطويل) */}
      <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-4 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-start shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-2 text-sm text-[var(--accent-primary)] font-bold shrink-0">
          <Filter size={16} />
          <span>{isRtl ? 'لوحة تصفية التقارير:' : 'Filters Ledger Panel:'}</span>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center w-full justify-start">
          {/* Status Filter */}
          <div className="flex items-center bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl px-3 py-1.5 focus-within:border-[var(--accent-primary)] transition-all min-w-[140px]">
            <span className="text-[11px] text-[var(--text-dim)] font-bold whitespace-nowrap ml-2">{isRtl ? 'الحالة:' : 'Status:'}</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-[var(--text-main)] text-xs outline-none cursor-pointer w-full border-none p-0 focus:ring-0"
            >
              <option value="all" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{isRtl ? 'كل الفواتير' : 'All Invoices'}</option>
              <option value="paid" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.statusPaid}</option>
              <option value="pending" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.statusPending}</option>
              <option value="unpaid" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.statusUnpaid}</option>
              <option value="refunded" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.statusRefunded}</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl px-3 py-1.5 focus-within:border-[var(--accent-primary)] transition-all min-w-[140px]">
            <span className="text-[11px] text-[var(--text-dim)] font-bold whitespace-nowrap ml-2">{isRtl ? 'الفترة:' : 'Range:'}</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent text-[var(--text-main)] text-xs outline-none cursor-pointer w-full border-none p-0 focus:ring-0"
            >
              <option value="all" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{isRtl ? 'كل الوقت (تراكمي)' : 'All Time (Cumulative)'}</option>
              <option value="this_month" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.thisMonth}</option>
              <option value="last_month" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.lastMonth}</option>
              <option value="last_6_months" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{isRtl ? 'آخر 6 أشهر' : 'Last 6 Months'}</option>
              <option value="last_year" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{isRtl ? 'آخر سنة كاملة' : 'Last Year'}</option>
              <option value="custom" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>📅 {isRtl ? 'تحديد مخصص...' : 'Custom Range...'}</option>
            </select>
          </div>

          {/* Custom Date Pickers (ظهور الكالندر عند التحديد المخصص) */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 animate-fadeIn">
              {/* Start Date */}
              <div className="flex items-center bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl px-3 py-1.5 focus-within:border-[var(--accent-primary)] transition-all">
                <span className="text-[11px] text-[var(--text-dim)] font-bold whitespace-nowrap ml-2">{isRtl ? 'من:' : 'From:'}</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-[var(--text-main)] text-xs outline-none cursor-pointer w-[125px] scheme-dark border-none p-0 focus:ring-0"
                />
              </div>

              {/* End Date */}
              <div className="flex items-center bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl px-3 py-1.5 focus-within:border-[var(--accent-primary)] transition-all">
                <span className="text-[11px] text-[var(--text-dim)] font-bold whitespace-nowrap ml-2">{isRtl ? 'إلى:' : 'To:'}</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-[var(--text-main)] text-xs outline-none cursor-pointer w-[125px] scheme-dark border-none p-0 focus:ring-0"
                />
              </div>
            </div>
          )}

          {/* Beneficiary Filter Dropdown Selection */}
          <div className="flex items-center bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl px-3 py-1.5 focus-within:border-[var(--accent-primary)] transition-all min-w-[240px] flex-1 sm:flex-none">
            <span className="text-[11px] text-[var(--text-dim)] font-bold whitespace-nowrap ml-2">{isRtl ? 'المستفيد:' : 'Beneficiary:'}</span>
            <select
              value={selectedAgencyId ? `agency_${selectedAgencyId}` : selectedTenantId ? `tenant_${selectedTenantId}` : 'all'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'all') {
                  setSelectedAgencyId(null);
                  setSelectedTenantId(null);
                } else if (val.startsWith('agency_')) {
                  setSelectedAgencyId(val.replace('agency_', ''));
                  setSelectedTenantId(null);
                } else if (val.startsWith('tenant_')) {
                  setSelectedTenantId(val.replace('tenant_', ''));
                  setSelectedAgencyId(null);
                }
              }}
              className="bg-transparent text-[var(--text-main)] text-xs outline-none cursor-pointer w-full border-none p-0 focus:ring-0"
            >
              <option value="all" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>
                {isRtl ? 'كل الوكالات والعملاء' : 'All Agencies & Clients'}
              </option>
              <optgroup label="🏢 الوكالات" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>
                {safeAgencies.map(a => (
                  <option key={a.id} value={`agency_${a.id}`} style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="👤 العملاء المباشرين" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>
                {directClients.map(c => (
                  <option key={c.id} value={`tenant_${c.id}`} style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
      </div>

      {/* 9 Premium KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Card 1: Total Revenue */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/35 transition-all shadow-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-[var(--text-dim)] font-medium uppercase tracking-wider">{d.totalRevenue}</span>
              <h3 className="text-3xl font-extrabold text-emerald-500 mt-2 tracking-tight">
                {formatUSD(totalRevenue)}
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/15 rounded-xl text-emerald-500">
              <DollarSign size={20} />
            </div>
          </div>
          <p className="text-xs text-[var(--text-dim)] mt-4 flex items-center gap-1">
            <TrendingUp size={12} className="text-emerald-500" />
            {d.totalRevenueSub}
          </p>
        </div>

        {/* Card 2: This Month Revenue */}
        <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/35 transition-all shadow-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-[var(--text-dim)] font-medium uppercase tracking-wider">{d.thisMonthRevenue}</span>
              <h3 className="text-3xl font-extrabold text-blue-500 mt-2 tracking-tight">
                {formatUSD(thisMonthRevenue)}
              </h3>
            </div>
            <div className="p-3 bg-blue-500/15 rounded-xl text-blue-500">
              <Landmark size={20} />
            </div>
          </div>
          <p className="text-xs text-[var(--text-dim)] mt-4 flex items-center gap-1">
            <Landmark size={12} className="text-blue-500" />
            {d.thisMonthRevenueSub}
          </p>
        </div>

        {/* Card 3: Last Month Revenue */}
        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/5 border border-purple-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-purple-500/35 transition-all shadow-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-[var(--text-dim)] font-medium uppercase tracking-wider">{d.lastMonthRevenue}</span>
              <h3 className="text-3xl font-extrabold text-purple-500 mt-2 tracking-tight">
                {formatUSD(lastMonthRevenue)}
              </h3>
            </div>
            <div className="p-3 bg-purple-500/15 rounded-xl text-purple-500">
              <Landmark size={20} />
            </div>
          </div>
          <p className="text-xs text-[var(--text-dim)] mt-4 flex items-center gap-1">
            <TrendingUp size={12} className="text-purple-500" />
            {d.lastMonthRevenueSub}
          </p>
        </div>

        {/* New Card 4: MRR */}
        <div className="bg-gradient-to-br from-teal-500/10 to-emerald-500/5 border border-teal-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-teal-500/35 transition-all shadow-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-[var(--text-dim)] font-medium uppercase tracking-wider">{d.mrr}</span>
              <h3 className="text-3xl font-extrabold text-teal-500 mt-2 tracking-tight">
                {formatUSD(calculatedMRR)}
              </h3>
            </div>
            <div className="p-3 bg-teal-500/15 rounded-xl text-teal-500">
              <RefreshCw size={20} />
            </div>
          </div>
          <p className="text-xs text-[var(--text-dim)] mt-4 flex items-center gap-1">
            <Calendar size={12} className="text-teal-500" />
            {d.mrrSub}
          </p>
        </div>

        {/* New Card 5: ARR */}
        <div className="bg-gradient-to-br from-indigo-500/10 to-blue-500/5 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-indigo-500/35 transition-all shadow-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-[var(--text-dim)] font-medium uppercase tracking-wider">{d.arr}</span>
              <h3 className="text-3xl font-extrabold text-indigo-500 mt-2 tracking-tight">
                {formatUSD(calculatedARR)}
              </h3>
            </div>
            <div className="p-3 bg-indigo-500/15 rounded-xl text-indigo-500">
              <TrendingUp size={20} />
            </div>
          </div>
          <p className="text-xs text-[var(--text-dim)] mt-4 flex items-center gap-1">
            <ShieldCheck size={12} className="text-indigo-500" />
            {d.arrSub}
          </p>
        </div>

        {/* New Card 6: ARPA */}
        <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border border-amber-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-amber-500/35 transition-all shadow-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-[var(--text-dim)] font-medium uppercase tracking-wider">{d.arpa}</span>
              <h3 className="text-3xl font-extrabold text-amber-550 dark:text-amber-455 mt-2 tracking-tight">
                {formatUSD(calculatedARPA)}
              </h3>
            </div>
            <div className="p-3 bg-amber-500/15 rounded-xl text-amber-550">
              <Users size={20} />
            </div>
          </div>
          <p className="text-xs text-[var(--text-dim)] mt-4 flex items-center gap-1">
            <Award size={12} className="text-amber-550" />
            {d.arpaSub}
          </p>
        </div>

        {/* Card 7: Invoices paid / pending */}
        <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-6 relative overflow-hidden hover:border-[var(--glass-border)] transition-all shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-[var(--text-dim)] font-medium uppercase tracking-wider">{d.invoicesPaidPending}</span>
              <h3 className="text-3xl font-extrabold text-[var(--text-main)] mt-2 tracking-tight">
                <span className="text-emerald-500">{paidInvoicesCount}</span>
                <span className="text-[var(--text-dim)] opacity-40 mx-2">/</span>
                <span className="text-amber-500">{pendingInvoicesCount}</span>
              </h3>
            </div>
            <div className="p-3 bg-[var(--bg-input)] rounded-xl text-[var(--text-main)]">
              <Receipt size={20} />
            </div>
          </div>
          <p className="text-xs text-[var(--text-dim)] mt-4 flex items-center gap-1">
            {d.invoicesPaidPendingSub}
          </p>
        </div>

        {/* Card 8: Agencies active / suspended */}
        <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-6 relative overflow-hidden hover:border-[var(--glass-border)] transition-all shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-[var(--text-dim)] font-medium uppercase tracking-wider">{d.agenciesActiveSuspended}</span>
              <h3 className="text-3xl font-extrabold text-[var(--text-main)] mt-2 tracking-tight">
                <span className="text-blue-500">{activeAgenciesCount}</span>
                <span className="text-[var(--text-dim)] opacity-40 mx-2">/</span>
                <span className="text-red-500">{suspendedAgenciesCount}</span>
              </h3>
            </div>
            <div className="p-3 bg-[var(--bg-input)] rounded-xl text-[var(--text-main)]">
              <Building2 size={20} />
            </div>
          </div>
          <p className="text-xs text-[var(--text-dim)] mt-4 flex items-center gap-1">
            {d.agenciesActiveSuspendedSub}
          </p>
        </div>

        {/* Card 9: Active Clients */}
        <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-6 relative overflow-hidden hover:border-[var(--glass-border)] transition-all shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-[var(--text-dim)] font-medium uppercase tracking-wider">{d.activeClients}</span>
              <h3 className="text-3xl font-extrabold text-cyan-500 dark:text-cyan-455 mt-2 tracking-tight">
                {activeClientsCount}
              </h3>
            </div>
            <div className="p-3 bg-[var(--bg-input)] rounded-xl text-[var(--text-main)]">
              <Users size={20} />
            </div>
          </div>
          <p className="text-xs text-[var(--text-dim)] mt-4 flex items-center gap-1">
            {d.activeClientsSub}
          </p>
        </div>

      </div>

      {/* Interactive Charts Dashboard Block */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Historical MRR Area Chart */}
        <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div>
            <h3 className="text-lg font-bold text-[var(--text-main)] mb-1 flex items-center gap-2">
              <TrendingUp className="text-emerald-500" size={18} />
              {d.chartMRRTitle}
            </h3>
            <p className="text-xs text-[var(--text-dim)] mb-6">
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
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                  <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-dim)" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-space-surface)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}
                    labelStyle={{ color: 'var(--text-main)', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="mrr" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorMRR)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-[var(--text-dim)] text-sm">
                Loading charts...
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Cumulative Partner Agencies signup curve */}
        <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div>
            <h3 className="text-lg font-bold text-[var(--text-main)] mb-1 flex items-center gap-2">
              <Building2 className="text-blue-500" size={18} />
              {d.chartGrowthTitle}
            </h3>
            <p className="text-xs text-[var(--text-dim)] mb-6">
              {d.chartGrowthSub}
            </p>
          </div>

          <div className="w-full flex-1">
            {mounted ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={agenciesGrowthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                  <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-dim)" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-space-surface)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}
                    labelStyle={{ color: 'var(--text-main)', fontWeight: 'bold' }}
                  />
                  <Line type="monotone" dataKey="agencies" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'var(--bg-color)' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-[var(--text-dim)] text-sm">
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
          <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-6 flex flex-col justify-between flex-1 shadow-sm">
            <div>
              <h3 className="text-lg font-bold text-[var(--text-main)] mb-1 flex items-center gap-2">
                <Award className="text-purple-500" size={18} />
                {d.chartTopAgenciesTitle}
              </h3>
              <p className="text-xs text-[var(--text-dim)] mb-6">
                {d.chartTopAgenciesSub}
              </p>
            </div>

            <div className="w-full flex-1">
              {mounted ? (
                topAgenciesData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={topAgenciesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                      <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={10} tickLine={false} />
                      <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ background: 'var(--bg-space-surface)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}
                        labelStyle={{ color: 'var(--text-main)', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="revenue" fill="#8b5cf6" radius={[6, 6, 0, 0]}>
                        {topAgenciesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#8b5cf6', '#6366f1', '#4f46e5', '#4338ca', '#3730a3'][index % 5]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-[var(--text-dim)] text-sm">
                    {d.noInvoices}
                  </div>
                )
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[var(--text-dim)] text-sm">
                  Loading charts...
                </div>
              )}
            </div>
          </div>

          {/* Original Plan Revenue Distribution */}
          <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-6 flex flex-col justify-between shadow-sm">
            <div>
              <h3 className="text-lg font-bold text-[var(--text-main)] mb-1 flex items-center gap-2">
                <Landmark className="text-emerald-500" size={18} />
                {d.revenueByPlan}
              </h3>
              <p className="text-xs text-[var(--text-dim)] mb-6">
                {d.revenueByPlanSub}
              </p>
            </div>

            <div className="space-y-4">
              {rawRevenueByPlan.map((plan) => {
                const percentage = Math.min(Math.max((plan.value / maxPlanValue) * 100, 4), 100)
                
                let barColor = 'from-emerald-500 to-teal-400 shadow-emerald-500/10'
                if (plan.name === 'starter') barColor = 'from-gray-550 to-gray-400 shadow-gray-500/10'
                if (plan.name === 'growth') barColor = 'from-blue-500 to-cyan-400 shadow-blue-500/10'
                if (plan.name === 'pro') barColor = 'from-purple-500 to-pink-500 shadow-purple-500/10'
                if (plan.name === 'vip') barColor = 'from-amber-500 to-yellow-400 shadow-amber-500/10'

                return (
                  <div key={plan.name} className="space-y-1 group">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-[var(--text-main)] capitalize group-hover:text-[var(--text-main)] transition-colors">
                        {plan.label}
                      </span>
                      <span className="font-bold text-[var(--text-dim)] group-hover:text-[var(--text-main)] transition-colors">
                        {formatUSD(plan.value)}
                      </span>
                    </div>
                    <div className="w-full bg-[var(--bg-input)] rounded-full h-3 overflow-hidden p-0.5 border border-[var(--glass-border)]">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${barColor} shadow-md transition-all duration-1000 ease-out`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="pt-4 border-t border-[var(--glass-border)] mt-6 flex justify-between items-center text-xs text-[var(--text-dim)]">
              <span>* Cumulative tier values</span>
              <span>$ USD ONLY</span>
            </div>
          </div>

        </div>

        {/* Recent Invoices Table with Advanced Filters */}
        <div className="lg:col-span-7 bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          
          {/* Header block with Filters */}
          <div className="space-y-4 mb-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-main)] mb-1 flex items-center gap-2">
                  <Receipt className="text-emerald-500" size={18} />
                  {d.invoicesTable}
                </h3>
                <p className="text-xs text-[var(--text-dim)]">
                  {d.invoicesTableSub}
                </p>
              </div>
            </div>

            {/* Filter controls row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-[var(--bg-input)] rounded-xl border border-[var(--glass-border)]">
              
              {/* Filter by Status */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-[var(--text-dim)] tracking-wider flex items-center gap-1">
                  <Filter size={10} />
                  {d.filterStatus}
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-[var(--bg-space-surface)] border border-[var(--glass-border)] text-[var(--text-main)] rounded-lg p-2 text-xs outline-none cursor-pointer hover:border-[var(--accent-primary)] transition-colors focus:ring-0"
                >
                  <option value="all" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.filterAll}</option>
                  <option value="paid" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.statusPaid}</option>
                  <option value="pending" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.statusPending}</option>
                  <option value="unpaid" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.statusUnpaid}</option>
                  <option value="refunded" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.statusRefunded}</option>
                </select>
              </div>

              {/* Filter by Date Range */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-[var(--text-dim)] tracking-wider flex items-center gap-1">
                  <Calendar size={10} />
                  {d.filterDate}
                </label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full bg-[var(--bg-space-surface)] border border-[var(--glass-border)] text-[var(--text-main)] rounded-lg p-2 text-xs outline-none cursor-pointer hover:border-[var(--accent-primary)] transition-colors focus:ring-0"
                >
                  <option value="all" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.filterAll}</option>
                  <option value="this_month" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.thisMonth}</option>
                  <option value="last_month" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.lastMonth}</option>
                  <option value="last_6_months" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{lang === 'ar' ? 'آخر 6 أشهر' : 'Last 6 Months'}</option>
                  <option value="last_year" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{lang === 'ar' ? 'آخر سنة كاملة' : 'Last Year'}</option>
                </select>
              </div>

            </div>
          </div>

          <div className="overflow-x-auto flex-1 min-h-[300px]">
            <table className="w-full text-sm text-right border-collapse">
              <thead>
                <tr className="text-[var(--text-dim)] border-b border-[var(--glass-border)] text-[11px] font-semibold uppercase tracking-wider">
                  <th className={`pb-3 px-2 ${isRtl ? 'text-right' : 'text-left'}`}>{d.invoiceNo}</th>
                  <th className={`pb-3 px-2 ${isRtl ? 'text-right' : 'text-left'}`}>{d.agency}</th>
                  <th className="pb-3 px-2 text-center">{d.invoiceType}</th>
                  <th className="pb-3 px-2 text-center">{d.amount}</th>
                  <th className="pb-3 px-2 text-center">{d.status}</th>
                  <th className={`pb-3 px-2 ${isRtl ? 'text-left' : 'text-right'}`}>{d.date}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--glass-border)]">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-24 text-center text-[var(--text-dim)] text-sm font-medium">
                      {d.noInvoices}
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    let statusStyle = 'bg-gray-500/10 text-gray-400'
                    let statusLabel: string = d.statusPending
                    
                    if (inv.status === 'paid') {
                      statusStyle = 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/15'
                      statusLabel = d.statusPaid
                    } else if (inv.status === 'pending') {
                      statusStyle = 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/15'
                      statusLabel = d.statusPending
                    } else if (inv.status === 'unpaid') {
                      statusStyle = 'bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/15'
                      statusLabel = d.statusUnpaid
                    } else if (inv.status === 'refunded') {
                      statusStyle = 'bg-purple-500/10 text-purple-500 dark:text-purple-400 border border-purple-500/15'
                      statusLabel = d.statusRefunded
                    }

                    // Format dates safely
                    const formattedDate = new Date(inv.created_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })

                    return (
                      <tr key={inv.id} className="hover:bg-[var(--hover-bg)] transition-colors">
                        <td className={`py-3 px-2 font-mono text-[11px] font-bold text-emerald-500 ${isRtl ? 'text-right' : 'text-left'}`}>
                          {inv.invoice_number || `INV-${inv.id.substring(0, 8).toUpperCase()}`}
                        </td>
                        <td className={`py-3 px-2 font-semibold text-[var(--text-main)] ${isRtl ? 'text-right' : 'text-left'}`}>
                          {getRecipientName(inv)}
                        </td>
                        <td className="py-3 px-2 text-center text-xs font-semibold text-[var(--text-dim)] capitalize">
                          {inv.invoice_type || 'subscription'}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-[var(--text-main)]">
                          {formatUSD(inv.amount)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusStyle}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className={`py-3 px-2 text-[var(--text-dim)] text-xs ${isRtl ? 'text-left' : 'text-right'}`}>
                          {formattedDate}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-4 border-t border-[var(--glass-border)] mt-4 flex justify-between items-center text-xs text-[var(--text-dim)]">
            <span>🛡️ End-to-end Encrypted Platform Billings</span>
            <span>$ USD ONLY</span>
          </div>

        </div>

      </div>

    </div>
  )
}
