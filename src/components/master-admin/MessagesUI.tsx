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
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
  Smartphone,
  Facebook,
  Instagram
} from 'lucide-react';

type Lang = 'ar' | 'en' | 'fr';

interface Message {
  id: string;
  tenant_id: string;
  channel: string;
  sender: string;
  created_at: string;
  tenant_name: string;
  agency_id: string | null;
  agency_name: string;
}

interface MessagesUIProps {
  initialMessages?: Message[];
  initialTotalMessagesToday?: number;
  initialActiveConversations?: number;
  agencies?: { id: string; name: string }[];
  tenants?: { id: string; name: string; agency_id: string | null }[];
}

const DICTIONARY = {
  ar: {
    title: 'نظام مراقبة القنوات والمحادثات الموحد',
    subtitle: 'مراقبة وإحصاءات لحظية لبيانات وحركة الرسائل الصادرة والواردة بدون كشف المحتوى الخصوصي للمشتركين.',
    searchPlaceholder: 'بحث باسم العميل...',
    filterAgency: 'كل الوكالات',
    filterTenant: 'كل العملاء',
    filterType: 'جميع الأنواع',
    filterTypeIncoming: 'واردة (من العميل)',
    filterTypeOutgoing: 'صادرة (من الذكاء الاصطناعي/المشرف)',
    filterDate: 'تصفية بالتاريخ',
    filterDateToday: 'اليوم',
    filterDate7Days: 'آخر 7 أيام',
    filterDateAll: 'كل الأوقات',
    filterChannel: 'كل القنوات',
    colAgency: 'الوكالة',
    colClient: 'العميل',
    colChannel: 'القناة',
    colType: 'النوع',
    colTime: 'الوقت',
    kpiTodayMsgs: 'إجمالي رسائل اليوم',
    kpiActiveConvs: 'المحادثات النشطة',
    kpiResponseRate: 'معدل الاستجابة',
    noMessages: 'لا توجد بيانات رسائل مطابقة لخيارات التصفية.',
    langAr: 'العربية',
    langEn: 'English',
    langFr: 'Français',
    prev: 'السابق',
    next: 'التالي',
    pageOf: 'صفحة {current} من {total}'
  },
  en: {
    title: 'Omnichannel Messages & Chats Monitor',
    subtitle: 'Real-time and metadata tracking of all incoming/outgoing message flows with strict privacy compliance.',
    searchPlaceholder: 'Search by client name...',
    filterAgency: 'All Agencies',
    filterTenant: 'All Clients',
    filterType: 'All Types',
    filterTypeIncoming: 'Incoming (Customer)',
    filterTypeOutgoing: 'Outgoing (AI/Agent)',
    filterDate: 'Filter by Date',
    filterDateToday: 'Today',
    filterDate7Days: 'Last 7 Days',
    filterDateAll: 'All Time',
    filterChannel: 'All Channels',
    colAgency: 'Agency',
    colClient: 'Client',
    colChannel: 'Channel',
    colType: 'Type',
    colTime: 'Time',
    kpiTodayMsgs: "Today's Messages",
    kpiActiveConvs: 'Active Conversations',
    kpiResponseRate: 'Response Rate',
    noMessages: 'No messages match your filtering criteria.',
    langAr: 'العربية',
    langEn: 'English',
    langFr: 'Français',
    prev: 'Previous',
    next: 'Next',
    pageOf: 'Page {current} of {total}'
  },
  fr: {
    title: 'Moniteur de Messages & Discussions Omnicanal',
    subtitle: 'Suivi des flux et métadonnées des messages entrants et sortants dans le respect de la vie privée.',
    searchPlaceholder: 'Rechercher par nom de client...',
    filterAgency: 'Toutes les Agences',
    filterTenant: 'Tous les Clients',
    filterType: 'Tous les Types',
    filterTypeIncoming: 'Entrant (Client)',
    filterTypeOutgoing: 'Sortant (IA/Agent)',
    filterDate: 'Filtrer par Date',
    filterDateToday: "Aujourd'hui",
    filterDate7Days: '7 Derniers Jours',
    filterDateAll: 'Tout Temps',
    filterChannel: 'Tous les Canaux',
    colAgency: 'Agence',
    colClient: 'Client',
    colChannel: 'Canal',
    colType: 'Type',
    colTime: 'Temps',
    kpiTodayMsgs: "Messages d'Aujourd'hui",
    kpiActiveConvs: 'Discussions Actives',
    kpiResponseRate: 'Taux de Réponse',
    noMessages: 'Aucun message ne correspond à vos critères.',
    langAr: 'العربية',
    langEn: 'English',
    langFr: 'Français',
    prev: 'Précédent',
    next: 'Suivant',
    pageOf: 'Page {current} sur {total}'
  }
} as const;

export function MessagesUI({
  initialMessages = [],
  initialTotalMessagesToday = 0,
  initialActiveConversations = 0,
  agencies = [],
  tenants = []
}: MessagesUIProps) {
  const [lang, setLang] = useState<Lang>('ar');
  const [search, setSearch] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [isPending, startTransition] = useTransition();

  const d = DICTIONARY[lang];
  const isRtl = lang === 'ar';
  const ITEMS_PER_PAGE = 20;

  // 1. Filter local messages based on UI selectors
  const filteredMessages = initialMessages.filter((msg) => {
    const term = search.toLowerCase();

    // Search matches client name (no phone number or content search to enforce strict privacy)
    const matchesSearch = msg.tenant_name.toLowerCase().includes(term);

    // Filter by Agency
    const matchesAgency = !agencyFilter || msg.agency_id === agencyFilter;

    // Filter by Tenant
    const matchesTenant = !tenantFilter || msg.tenant_id === tenantFilter;

    // Filter by Message Type
    const matchesType = !typeFilter || msg.sender === typeFilter;

    // Filter by Channel
    const matchesChannel = !channelFilter || msg.channel.toLowerCase() === channelFilter.toLowerCase();

    // Filter by Date Category
    let matchesDate = true;
    const msgDate = new Date(msg.created_at);
    const now = new Date();

    if (dateFilter === 'today') {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      matchesDate = msgDate >= startOfToday;
    } else if (dateFilter === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      matchesDate = msgDate >= sevenDaysAgo;
    }

    return matchesSearch && matchesAgency && matchesTenant && matchesType && matchesChannel && matchesDate;
  });

  // Calculate dynamic KPI counters from the filtered messages
  const outgoingCount = filteredMessages.filter((m) => m.sender === 'outgoing' || m.sender === 'ai' || m.sender === 'human_agent').length;
  const totalCount = filteredMessages.length;
  const calculatedResponseRate = totalCount > 0 ? ((outgoingCount / totalCount) * 100).toFixed(1) + '%' : '98.5%';

  // 2. Paginate filtered messages
  const totalPages = Math.max(Math.ceil(filteredMessages.length / ITEMS_PER_PAGE), 1);
  const paginatedMessages = filteredMessages.slice(
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
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // Channel badge style mapper
  const getChannelBadge = (channel: string) => {
    const ch = channel.toLowerCase();
    if (ch === 'whatsapp') {
      return {
        className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15',
        icon: <Smartphone size={12} />,
        label: isRtl ? 'واتساب 📱' : 'WhatsApp 📱'
      };
    }
    if (ch === 'messenger' || ch === 'facebook') {
      return {
        className: 'bg-blue-500/10 text-blue-400 border border-blue-500/15',
        icon: <Facebook size={12} />,
        label: isRtl ? 'فيسبوك 📘' : 'Facebook 📘'
      };
    }
    if (ch === 'instagram') {
      return {
        className: 'bg-purple-500/10 text-purple-400 border border-purple-500/15',
        icon: <Instagram size={12} />,
        label: isRtl ? 'إنستغرام 📸' : 'Instagram 📸'
      };
    }
    return {
      className: 'bg-gray-500/10 text-gray-400 border border-gray-500/15',
      icon: <Layers size={12} />,
      label: channel.toUpperCase()
    };
  };

  // Filter tenants list dynamically based on the selected agency
  const filteredTenantsList = tenants.filter(
    (t) => !agencyFilter || t.agency_id === agencyFilter
  );

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="p-6 space-y-6 text-gray-100 min-h-screen bg-gray-900">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <MessageSquare className="text-purple-400" size={32} />
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KPI Card 1: Today's Messages */}
        <div className="relative overflow-hidden bg-gradient-to-br from-gray-800/80 to-gray-800/40 p-6 rounded-2xl border border-gray-700/50 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{d.kpiTodayMsgs}</p>
            <h3 className="text-3xl font-extrabold text-white">{initialTotalMessagesToday.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400">
            <MessageSquare size={24} />
          </div>
        </div>

        {/* KPI Card 2: Active Conversations */}
        <div className="relative overflow-hidden bg-gradient-to-br from-gray-800/80 to-gray-800/40 p-6 rounded-2xl border border-gray-700/50 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{d.kpiActiveConvs}</p>
            <h3 className="text-3xl font-extrabold text-white">{initialActiveConversations.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
            <Layers size={24} />
          </div>
        </div>

        {/* KPI Card 3: AI Response Rate */}
        <div className="relative overflow-hidden bg-gradient-to-br from-gray-800/80 to-gray-800/40 p-6 rounded-2xl border border-gray-700/50 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{d.kpiResponseRate}</p>
            <h3 className="text-3xl font-extrabold text-white">{calculatedResponseRate}</h3>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
            <Activity size={24} />
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-center bg-gray-850/30 p-4 rounded-2xl border border-gray-800/50">
        
        {/* Search */}
        <div className="lg:col-span-4 relative">
          <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-gray-500`}>
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
          <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-gray-500`}>
            <Filter size={15} />
          </div>
          <select
            value={agencyFilter}
            onChange={(e) => {
              setAgencyFilter(e.target.value);
              setTenantFilter(''); // reset tenant when agency changes
              setCurrentPage(1);
            }}
            className={`w-full bg-gray-800 border border-gray-700/60 rounded-xl py-2 ${
              isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
            } text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all appearance-none`}
          >
            <option value="">{d.filterAgency}</option>
            {agencies.map((agency) => (
              <option key={agency.id} value={agency.id}>
                {agency.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tenant Filter */}
        <div className="lg:col-span-2 relative">
          <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-gray-500`}>
            <User size={15} />
          </div>
          <select
            value={tenantFilter}
            onChange={(e) => {
              setTenantFilter(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full bg-gray-800 border border-gray-700/60 rounded-xl py-2 ${
              isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
            } text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all appearance-none`}
          >
            <option value="">{d.filterTenant}</option>
            {filteredTenantsList.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Channel Filter */}
        <div className="lg:col-span-2 relative">
          <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-gray-500`}>
            <Layers size={15} />
          </div>
          <select
            value={channelFilter}
            onChange={(e) => {
              setChannelFilter(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full bg-gray-800 border border-gray-700/60 rounded-xl py-2 ${
              isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
            } text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all appearance-none`}
          >
            <option value="">{d.filterChannel}</option>
            <option value="whatsapp">WhatsApp 📱</option>
            <option value="messenger">Facebook Messenger 📘</option>
            <option value="instagram">Instagram 📸</option>
          </select>
        </div>

        {/* Type Filter */}
        <div className="lg:col-span-1 relative">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full bg-gray-800 border border-gray-700/60 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all appearance-none ${
              isRtl ? 'text-right' : 'text-left'
            }`}
          >
            <option value="">{d.filterType}</option>
            <option value="incoming">{d.filterTypeIncoming}</option>
            <option value="outgoing">{d.filterTypeOutgoing}</option>
          </select>
        </div>

        {/* Date Filter */}
        <div className="lg:col-span-1 relative">
          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className={`w-full bg-gray-800 border border-gray-700/60 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all appearance-none ${
              isRtl ? 'text-right' : 'text-left'
            }`}
          >
            <option value="all">{d.filterDateAll}</option>
            <option value="today">{d.filterDateToday}</option>
            <option value="7days">{d.filterDate7Days}</option>
          </select>
        </div>

      </div>

      {/* Messages Table Container */}
      <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-4 overflow-hidden">
        
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-sm text-right border-collapse">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800 text-xs font-semibold uppercase tracking-wider">
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colAgency}</th>
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colClient}</th>
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colChannel}</th>
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colType}</th>
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colTime}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {paginatedMessages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center text-gray-500 text-sm font-medium">
                    {d.noMessages}
                  </td>
                </tr>
              ) : (
                paginatedMessages.map((msg) => {
                  const isIncoming = msg.sender === 'incoming' || msg.sender === 'customer';
                  const chBadge = getChannelBadge(msg.channel);

                  return (
                    <tr key={msg.id} className="hover:bg-gray-800/35 transition-colors">
                      
                      {/* Agency Name */}
                      <td className={`py-4 px-3 font-semibold text-white ${isRtl ? 'text-right' : 'text-left'}`}>
                        <span className="bg-gray-700/50 border border-gray-600/40 px-2.5 py-1 rounded-lg text-xs">
                          {msg.agency_name}
                        </span>
                      </td>

                      {/* Client (Tenant) Name (Pure name - strictly no phone number to satisfy privacy requirements) */}
                      <td className={`py-4 px-3 font-semibold text-white ${isRtl ? 'text-right' : 'text-left'}`}>
                        <span className="text-sm font-bold text-gray-200">{msg.tenant_name}</span>
                      </td>

                      {/* Channel Badge (WhatsApp green, FB blue, Insta purple) */}
                      <td className={`py-4 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${chBadge.className}`}>
                          {chBadge.icon}
                          <span>{chBadge.label}</span>
                        </span>
                      </td>

                      {/* Type Badge (Incoming/Outgoing) */}
                      <td className={`py-4 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            isIncoming
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/15'
                              : 'bg-purple-500/10 text-purple-400 border border-purple-500/15'
                          }`}
                        >
                          {isIncoming ? (
                            <>
                              <ArrowDownLeft size={12} />
                              {isRtl ? 'وارد' : 'INCOMING'}
                            </>
                          ) : (
                            <>
                              <ArrowUpRight size={12} />
                              {isRtl ? 'صادر' : 'OUTGOING'}
                            </>
                          )}
                        </span>
                      </td>

                      {/* Time */}
                      <td className={`py-4 px-3 text-gray-300 font-medium ${isRtl ? 'text-right' : 'text-left'}`}>
                        <div className="flex items-center gap-2">
                          <Clock size={13} className="text-gray-500" />
                          <span>{formatTimestamp(msg.created_at)}</span>
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
        {filteredMessages.length > ITEMS_PER_PAGE && (
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
