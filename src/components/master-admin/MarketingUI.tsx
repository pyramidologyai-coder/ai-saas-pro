'use client';

import React, { useState, useTransition } from 'react';
import {
  Search,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  Activity,
  Megaphone,
  Percent,
  Users,
  CheckCircle
} from 'lucide-react';

type Lang = 'ar' | 'en' | 'fr';

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  recipients_count: number;
  sent_count: number;
  failed_count: number;
  template_name: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  tenant_id: string;
  agency_id: string | null;
  tenant_name: string;
  agency_name: string;
}

interface MarketingUIProps {
  campaigns?: Campaign[];
  agencies?: { id: string; name: string }[];
}

const DICTIONARY = {
  ar: {
    title: 'نظام إدارة ومراقبة الحملات التسويقية',
    subtitle: 'تتبع شامل وحي لكافة الحملات الترويجية وحملات واتساب الصادرة من مختلف الوكالات والمستأجرين.',
    searchPlaceholder: 'بحث باسم الحملة أو العميل...',
    filterAgency: 'كل الوكالات',
    filterStatus: 'جميع الحالات',
    filterType: 'جميع الأنواع',
    filterStatusSent: 'مرسلة',
    filterStatusScheduled: 'مجدولة',
    filterStatusDraft: 'مسودة',
    filterStatusFailed: 'فشلت',
    colCampaignName: 'اسم الحملة',
    colAgency: 'الوكالة',
    colClient: 'العميل',
    colType: 'النوع',
    colStatus: 'الحالة',
    colRecipients: 'المستهدفين',
    colSent: 'المرسل',
    colFailed: 'الفاشل',
    colDate: 'التاريخ',
    kpiTotalCampaigns: 'إجمالي الحملات',
    kpiSentCampaigns: 'الحملات المرسلة',
    kpiTotalRecipients: 'إجمالي المستهدفين',
    kpiSuccessRate: 'معدل النجاح',
    noCampaigns: 'لا توجد حملات تسويقية مطابقة لخيارات التصفية.',
    langAr: 'العربية',
    langEn: 'English',
    langFr: 'Français',
    prev: 'السابق',
    next: 'التالي',
    pageOf: 'صفحة {current} من {total}'
  },
  en: {
    title: 'Marketing Campaigns Dashboard',
    subtitle: 'Comprehensive and live tracking of all promotional and WhatsApp campaigns across agencies and tenants.',
    searchPlaceholder: 'Search by campaign or client name...',
    filterAgency: 'All Agencies',
    filterStatus: 'All Statuses',
    filterType: 'All Types',
    filterStatusSent: 'Sent',
    filterStatusScheduled: 'Scheduled',
    filterStatusDraft: 'Draft',
    filterStatusFailed: 'Failed',
    colCampaignName: 'Campaign Name',
    colAgency: 'Agency',
    colClient: 'Client',
    colType: 'Type',
    colStatus: 'Status',
    colRecipients: 'Recipients',
    colSent: 'Sent',
    colFailed: 'Failed',
    colDate: 'Date',
    kpiTotalCampaigns: 'Total Campaigns',
    kpiSentCampaigns: 'Sent Campaigns',
    kpiTotalRecipients: 'Total Recipients',
    kpiSuccessRate: 'Success Rate',
    noCampaigns: 'No marketing campaigns match your filtering criteria.',
    langAr: 'العربية',
    langEn: 'English',
    langFr: 'Français',
    prev: 'Previous',
    next: 'Next',
    pageOf: 'Page {current} of {total}'
  },
  fr: {
    title: 'Tableau des Campagnes Marketing',
    subtitle: 'Suivi complet et en direct de toutes les campagnes promotionnelles et WhatsApp de toutes les agences.',
    searchPlaceholder: 'Rechercher par campagne ou client...',
    filterAgency: 'Toutes les Agences',
    filterStatus: 'Tous les Statuts',
    filterType: 'Tous les Types',
    filterStatusSent: 'Envoyée',
    filterStatusScheduled: 'Planifiée',
    filterStatusDraft: 'Brouillon',
    filterStatusFailed: 'Échouée',
    colCampaignName: 'Nom de la Campagne',
    colAgency: 'Agence',
    colClient: 'Client',
    colType: 'Type',
    colStatus: 'Statut',
    colRecipients: 'Destinataires',
    colSent: 'Envoyés',
    colFailed: 'Échoués',
    colDate: 'Date',
    kpiTotalCampaigns: 'Total Campagnes',
    kpiSentCampaigns: 'Campagnes Envoyées',
    kpiTotalRecipients: 'Total Destinataires',
    kpiSuccessRate: 'Taux de Réussite',
    noCampaigns: 'Aucune campagne marketing ne correspond à vos critères.',
    langAr: 'العربية',
    langEn: 'English',
    langFr: 'Français',
    prev: 'Précédent',
    next: 'Suivant',
    pageOf: 'Page {current} sur {total}'
  }
} as const;

export function MasterMarketingUI({ campaigns = [], agencies = [] }: MarketingUIProps) {
  const [lang, setLang] = useState<Lang>('ar');
  const [search, setSearch] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [isPending, startTransition] = useTransition();

  const d = DICTIONARY[lang];
  const isRtl = lang === 'ar';
  const ITEMS_PER_PAGE = 20;

  // Extract unique agencies and types dynamically from the campaign list for filters
  const uniqueAgencies = Array.from(
    new Set(
      campaigns
        .filter((c) => c.agency_id && c.agency_name)
        .map((c) => JSON.stringify({ id: c.agency_id, name: c.agency_name }))
    )
  ).map((str) => JSON.parse(str));

  const uniqueTypes = Array.from(new Set(campaigns.map((c) => c.type.toLowerCase())));

  // Use passed agencies or fallback to unique agencies extracted from campaigns
  const agenciesList = agencies.length > 0 ? agencies : uniqueAgencies;
  const typeOptions = uniqueTypes.length > 0 ? uniqueTypes : ['whatsapp', 'messenger', 'instagram'];

  // 1. Filter local campaigns list based on UI filters
  const filteredCampaigns = campaigns.filter((camp) => {
    const term = search.toLowerCase();

    // Search matches campaign name or client name
    const matchesSearch =
      camp.name.toLowerCase().includes(term) ||
      camp.tenant_name.toLowerCase().includes(term);

    // Filter by Agency
    const matchesAgency = !agencyFilter || camp.agency_id === agencyFilter;

    // Filter by Status
    const matchesStatus = !statusFilter || camp.status.toLowerCase() === statusFilter.toLowerCase();

    // Filter by Type
    const matchesType = !typeFilter || camp.type.toLowerCase() === typeFilter.toLowerCase();

    return matchesSearch && matchesAgency && matchesStatus && matchesType;
  });

  // Calculate dynamic KPIs from the filtered dataset
  const totalCampaigns = filteredCampaigns.length;
  const sentCampaigns = filteredCampaigns.filter((c) => c.status.toLowerCase() === 'sent').length;
  
  const totalRecipients = filteredCampaigns.reduce((acc, curr) => acc + (curr.recipients_count || 0), 0);
  const totalSent = filteredCampaigns.reduce((acc, curr) => acc + (curr.sent_count || 0), 0);
  const totalFailed = filteredCampaigns.reduce((acc, curr) => acc + (curr.failed_count || 0), 0);

  const successRate =
    totalRecipients > 0
      ? ((totalSent / totalRecipients) * 100).toFixed(1) + '%'
      : totalSent + totalFailed > 0
      ? ((totalSent / (totalSent + totalFailed)) * 100).toFixed(1) + '%'
      : '100%';

  // 2. Paginate filtered campaigns
  const totalPages = Math.max(Math.ceil(filteredCampaigns.length / ITEMS_PER_PAGE), 1);
  const paginatedCampaigns = filteredCampaigns.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // Get dynamic status badge styles
  const getStatusBadgeStyle = (status: string) => {
    const st = status.toLowerCase();
    if (st === 'sent') {
      return {
        background: 'var(--success-bg, rgba(16, 185, 129, 0.1))',
        color: 'var(--success-text, #10b981)',
        border: '1px solid rgba(16, 185, 129, 0.2)'
      };
    }
    if (st === 'scheduled') {
      return {
        background: 'var(--bg-input, rgba(59, 130, 246, 0.08))',
        color: 'var(--accent-primary, #6366f1)',
        border: '1px solid var(--glass-border, rgba(99, 102, 241, 0.2))'
      };
    }
    if (st === 'failed') {
      return {
        background: 'var(--cyber-red-glow, rgba(239, 68, 68, 0.1))',
        color: 'var(--cyber-red, #ef4444)',
        border: '1px solid rgba(239, 68, 68, 0.2)'
      };
    }
    return {
      background: 'var(--hover-bg, rgba(156, 163, 175, 0.1))',
      color: 'var(--text-dim, #9ca3af)',
      border: '1px solid var(--glass-border, rgba(156, 163, 175, 0.2))'
    };
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="p-6 space-y-6 min-h-screen text-[var(--text-main)] bg-[var(--bg-color)]">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-[var(--glass-border)]">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-main)] flex items-center gap-3">
            <Megaphone className="text-[var(--accent-primary)]" size={32} />
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

      {/* KPI Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Card 1: Total Campaigns */}
        <div className="relative overflow-hidden bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--glass-border)] backdrop-blur-sm shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-wider">{d.kpiTotalCampaigns}</p>
            <h3 className="text-3xl font-extrabold text-[var(--text-main)]">{totalCampaigns.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-[var(--bg-input)] rounded-xl border border-[var(--glass-border)] text-[var(--accent-primary)]">
            <Megaphone size={24} />
          </div>
        </div>

        {/* Card 2: Sent Campaigns */}
        <div className="relative overflow-hidden bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--glass-border)] backdrop-blur-sm shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-wider">{d.kpiSentCampaigns}</p>
            <h3 className="text-3xl font-extrabold text-[var(--text-main)]">{sentCampaigns.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-[var(--success-bg)] rounded-xl border border-[var(--success-bg)] text-[var(--success-text)]">
            <CheckCircle size={24} />
          </div>
        </div>

        {/* Card 3: Total Recipients */}
        <div className="relative overflow-hidden bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--glass-border)] backdrop-blur-sm shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-wider">{d.kpiTotalRecipients}</p>
            <h3 className="text-3xl font-extrabold text-[var(--text-main)]">{totalRecipients.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-[var(--bg-input)] rounded-xl border border-[var(--glass-border)] text-blue-500">
            <Users size={24} />
          </div>
        </div>

        {/* Card 4: Success Rate % */}
        <div className="relative overflow-hidden bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--glass-border)] backdrop-blur-sm shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-wider">{d.kpiSuccessRate}</p>
            <h3 className="text-3xl font-extrabold text-[var(--text-main)]">{successRate}</h3>
          </div>
          <div className="p-3 bg-[var(--bg-input)] rounded-xl border border-[var(--glass-border)] text-amber-500">
            <Percent size={24} />
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-center bg-[var(--card-bg)] p-4 rounded-2xl border border-[var(--glass-border)] shadow-sm">
        
        {/* Search */}
        <div className="lg:col-span-6 relative">
          <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-[var(--text-dim)] pointer-events-none`}>
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder={d.searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl py-2 ${
              isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'
            } text-sm text-[var(--text-main)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-primary)] transition-all`}
          />
        </div>

        {/* Agency Filter */}
        <div className="lg:col-span-2 relative">
          <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-[var(--text-dim)] pointer-events-none`}>
            <Filter size={15} />
          </div>
          <select
            value={agencyFilter}
            onChange={(e) => {
              setAgencyFilter(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl py-2 ${
              isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
            } text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)] transition-all appearance-none cursor-pointer`}
          >
            <option value="" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.filterAgency}</option>
            {agenciesList.map((agency) => (
              <option key={agency.id} value={agency.id} style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>
                {agency.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="lg:col-span-2 relative">
          <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-[var(--text-dim)] pointer-events-none`}>
            <Activity size={15} />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl py-2 ${
              isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
            } text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)] transition-all appearance-none cursor-pointer`}
          >
            <option value="" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.filterStatus}</option>
            <option value="sent" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.filterStatusSent}</option>
            <option value="scheduled" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.filterStatusScheduled}</option>
            <option value="draft" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.filterStatusDraft}</option>
            <option value="failed" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.filterStatusFailed}</option>
          </select>
        </div>

        {/* Type Filter */}
        <div className="lg:col-span-2 relative">
          <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-[var(--text-dim)] pointer-events-none`}>
            <Megaphone size={15} />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl py-2 ${
              isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
            } text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)] transition-all appearance-none cursor-pointer`}
          >
            <option value="" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.filterType}</option>
            {typeOptions.map((t) => (
              <option key={t} value={t} className="capitalize" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>
                {t.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* Campaigns Table Container */}
      <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-4 overflow-hidden shadow-sm">
        
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-sm text-right border-collapse">
            <thead>
              <tr className="text-[var(--text-dim)] border-b border-[var(--glass-border)] text-xs font-semibold uppercase tracking-wider">
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colCampaignName}</th>
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colAgency}</th>
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colClient}</th>
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colType}</th>
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colStatus}</th>
                <th className="pb-3 px-3 text-center">{d.colRecipients}</th>
                <th className="pb-3 px-3 text-center">{d.colSent}</th>
                <th className="pb-3 px-3 text-center">{d.colFailed}</th>
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colDate}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]">
              {paginatedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-24 text-center text-[var(--text-dim)] text-sm font-medium">
                    {d.noCampaigns}
                  </td>
                </tr>
              ) : (
                paginatedCampaigns.map((camp) => {
                  return (
                    <tr key={camp.id} className="hover:bg-[var(--hover-bg)] transition-colors">
                      
                      {/* Campaign Name */}
                      <td className={`py-4 px-3 font-semibold text-[var(--text-main)] ${isRtl ? 'text-right' : 'text-left'}`}>
                        <span className="text-sm font-bold text-[var(--text-main)]">{camp.name}</span>
                      </td>

                      {/* Agency Name */}
                      <td className={`py-4 px-3 text-[var(--text-main)] ${isRtl ? 'text-right' : 'text-left'}`}>
                        <span className="bg-[var(--bg-input)] border border-[var(--glass-border)] px-2.5 py-1 rounded-lg text-xs">
                          {camp.agency_name}
                        </span>
                      </td>

                      {/* Client (Tenant) Name */}
                      <td className={`py-4 px-3 text-[var(--text-main)] ${isRtl ? 'text-right' : 'text-left'}`}>
                        <span className="text-sm font-medium text-[var(--text-main)]">{camp.tenant_name}</span>
                      </td>

                      {/* Channel Type */}
                      <td className={`py-4 px-3 text-[var(--text-main)] font-mono text-xs uppercase ${isRtl ? 'text-right' : 'text-left'}`}>
                        {camp.type}
                      </td>

                      {/* Status Badge */}
                      <td className={`py-4 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>
                        <span 
                          style={getStatusBadgeStyle(camp.status)}
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                        >
                          {camp.status}
                        </span>
                      </td>

                      {/* Recipients Count */}
                      <td className="py-4 px-3 text-center font-mono text-sm text-[var(--text-main)] font-semibold">
                        {(camp.recipients_count || 0).toLocaleString()}
                      </td>

                      {/* Sent Count */}
                      <td className="py-4 px-3 text-center font-mono text-sm text-emerald-500 dark:text-emerald-400 font-bold">
                        {(camp.sent_count || 0).toLocaleString()}
                      </td>

                      {/* Failed Count */}
                      <td className="py-4 px-3 text-center font-mono text-sm text-red-500 dark:text-red-400 font-semibold">
                        {(camp.failed_count || 0).toLocaleString()}
                      </td>

                      {/* Created At Date */}
                      <td className={`py-4 px-3 text-[var(--text-main)] font-medium ${isRtl ? 'text-right' : 'text-left'}`}>
                        <div className="flex items-center gap-2">
                          <Clock size={13} className="text-[var(--text-dim)]" />
                          <span>{formatTimestamp(camp.created_at)}</span>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls bar */}
        {filteredCampaigns.length > ITEMS_PER_PAGE && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-[var(--glass-border)] mt-4 text-xs text-[var(--text-dim)]">
            <div>
              {d.pageOf.replace('{current}', String(currentPage)).replace('{total}', String(totalPages))}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-[var(--bg-input)] hover:bg-[var(--hover-bg)] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-[var(--glass-border)] text-[var(--text-main)] font-semibold transition-all flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft size={14} />
                {d.prev}
              </button>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-[var(--bg-input)] hover:bg-[var(--hover-bg)] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-[var(--glass-border)] text-[var(--text-main)] font-semibold transition-all flex items-center gap-1 cursor-pointer"
              >
                {d.next}
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
