'use client';

import React, { useState, useTransition } from 'react';
import {
  Search,
  Calendar,
  MessageSquare,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  User,
  Activity,
  Layers,
  CheckCircle,
  Megaphone,
  Percent,
  Users
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

  // Get status badge colors
  const getStatusBadge = (status: string) => {
    const st = status.toLowerCase();
    if (st === 'sent') {
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15';
    }
    if (st === 'scheduled') {
      return 'bg-blue-500/10 text-blue-400 border border-blue-500/15';
    }
    if (st === 'failed') {
      return 'bg-red-500/10 text-red-400 border border-red-500/15';
    }
    return 'bg-gray-500/10 text-gray-400 border border-gray-500/15';
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="p-6 space-y-6 text-gray-100 min-h-screen bg-gray-900">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Megaphone className="text-purple-400" size={32} />
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
              lang === 'ar' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            {d.langAr}
          </button>
          <button
            onClick={() => startTransition(() => setLang('en'))}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              lang === 'en' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            {d.langEn}
          </button>
          <button
            onClick={() => startTransition(() => setLang('fr'))}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              lang === 'fr' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            {d.langFr}
          </button>
        </div>
      </div>

      {/* KPI Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Card 1: Total Campaigns */}
        <div className="relative overflow-hidden bg-gradient-to-br from-gray-800/80 to-gray-800/40 p-6 rounded-2xl border border-gray-700/50 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{d.kpiTotalCampaigns}</p>
            <h3 className="text-3xl font-extrabold text-white">{totalCampaigns.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400">
            <Megaphone size={24} />
          </div>
        </div>

        {/* Card 2: Sent Campaigns */}
        <div className="relative overflow-hidden bg-gradient-to-br from-gray-800/80 to-gray-800/40 p-6 rounded-2xl border border-gray-700/50 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{d.kpiSentCampaigns}</p>
            <h3 className="text-3xl font-extrabold text-white">{sentCampaigns.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
            <CheckCircle size={24} />
          </div>
        </div>

        {/* Card 3: Total Recipients */}
        <div className="relative overflow-hidden bg-gradient-to-br from-gray-800/80 to-gray-800/40 p-6 rounded-2xl border border-gray-700/50 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{d.kpiTotalRecipients}</p>
            <h3 className="text-3xl font-extrabold text-white">{totalRecipients.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
            <Users size={24} />
          </div>
        </div>

        {/* Card 4: Success Rate % */}
        <div className="relative overflow-hidden bg-gradient-to-br from-gray-800/80 to-gray-800/40 p-6 rounded-2xl border border-gray-700/50 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{d.kpiSuccessRate}</p>
            <h3 className="text-3xl font-extrabold text-white">{successRate}</h3>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
            <Percent size={24} />
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-center bg-gray-850/30 p-4 rounded-2xl border border-gray-800/50">
        
        {/* Search */}
        <div className="lg:col-span-6 relative">
          <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-gray-500 pointer-events-none`}>
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
            className={`w-full bg-gray-800 border border-gray-700/60 rounded-xl py-2 ${
              isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'
            } text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all`}
          />
        </div>

        {/* Agency Filter */}
        <div className="lg:col-span-2 relative">
          <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-gray-500 pointer-events-none`}>
            <Filter size={15} />
          </div>
          <select
            value={agencyFilter}
            onChange={(e) => {
              setAgencyFilter(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full bg-gray-800 border border-gray-700/60 rounded-xl py-2 ${
              isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
            } text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all appearance-none cursor-pointer`}
          >
            <option value="">{d.filterAgency}</option>
            {agenciesList.map((agency) => (
              <option key={agency.id} value={agency.id}>
                {agency.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="lg:col-span-2 relative">
          <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-gray-500 pointer-events-none`}>
            <Activity size={15} />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full bg-gray-800 border border-gray-700/60 rounded-xl py-2 ${
              isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
            } text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all appearance-none cursor-pointer`}
          >
            <option value="">{d.filterStatus}</option>
            <option value="sent">{d.filterStatusSent}</option>
            <option value="scheduled">{d.filterStatusScheduled}</option>
            <option value="draft">{d.filterStatusDraft}</option>
            <option value="failed">{d.filterStatusFailed}</option>
          </select>
        </div>

        {/* Type Filter */}
        <div className="lg:col-span-2 relative">
          <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-gray-500 pointer-events-none`}>
            <Megaphone size={15} />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full bg-gray-800 border border-gray-700/60 rounded-xl py-2 ${
              isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
            } text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all appearance-none cursor-pointer`}
          >
            <option value="">{d.filterType}</option>
            {typeOptions.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* Campaigns Table Container */}
      <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-4 overflow-hidden">
        
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-sm text-right border-collapse">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800 text-xs font-semibold uppercase tracking-wider">
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
            <tbody className="divide-y divide-gray-800/50">
              {paginatedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-24 text-center text-gray-500 text-sm font-medium">
                    {d.noCampaigns}
                  </td>
                </tr>
              ) : (
                paginatedCampaigns.map((camp) => {
                  return (
                    <tr key={camp.id} className="hover:bg-gray-800/35 transition-colors">
                      
                      {/* Campaign Name */}
                      <td className={`py-4 px-3 font-semibold text-white ${isRtl ? 'text-right' : 'text-left'}`}>
                        <span className="text-sm font-bold text-gray-200">{camp.name}</span>
                      </td>

                      {/* Agency Name */}
                      <td className={`py-4 px-3 text-gray-300 ${isRtl ? 'text-right' : 'text-left'}`}>
                        <span className="bg-gray-700/50 border border-gray-600/40 px-2.5 py-1 rounded-lg text-xs">
                          {camp.agency_name}
                        </span>
                      </td>

                      {/* Client (Tenant) Name */}
                      <td className={`py-4 px-3 text-gray-300 ${isRtl ? 'text-right' : 'text-left'}`}>
                        <span className="text-sm font-medium text-gray-200">{camp.tenant_name}</span>
                      </td>

                      {/* Channel Type */}
                      <td className={`py-4 px-3 text-gray-300 font-mono text-xs uppercase ${isRtl ? 'text-right' : 'text-left'}`}>
                        {camp.type}
                      </td>

                      {/* Status Badge */}
                      <td className={`py-4 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusBadge(camp.status)}`}>
                          {camp.status}
                        </span>
                      </td>

                      {/* Recipients Count */}
                      <td className="py-4 px-3 text-center font-mono text-sm text-gray-300 font-semibold">
                        {(camp.recipients_count || 0).toLocaleString()}
                      </td>

                      {/* Sent Count */}
                      <td className="py-4 px-3 text-center font-mono text-sm text-emerald-400 font-bold">
                        {(camp.sent_count || 0).toLocaleString()}
                      </td>

                      {/* Failed Count */}
                      <td className="py-4 px-3 text-center font-mono text-sm text-red-400 font-semibold">
                        {(camp.failed_count || 0).toLocaleString()}
                      </td>

                      {/* Created At Date */}
                      <td className={`py-4 px-3 text-gray-300 font-medium ${isRtl ? 'text-right' : 'text-left'}`}>
                        <div className="flex items-center gap-2">
                          <Clock size={13} className="text-gray-500" />
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
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-800 mt-4 text-xs text-gray-400">
            <div>
              {d.pageOf.replace('{current}', String(currentPage)).replace('{total}', String(totalPages))}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-gray-850 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-gray-700/50 text-white font-semibold transition-all flex items-center gap-1"
              >
                <ChevronLeft size={14} />
                {d.prev}
              </button>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-gray-850 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-gray-700/50 text-white font-semibold transition-all flex items-center gap-1"
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
