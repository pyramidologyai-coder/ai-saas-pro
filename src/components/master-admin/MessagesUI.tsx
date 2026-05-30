'use client';

import React, { useState, useTransition, useEffect } from 'react';
import {
  Search,
  Calendar,
  MessageSquare,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  User,
  Layers,
  Smartphone,
  Facebook,
  Instagram,
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  Inbox,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell
} from 'recharts';

type Lang = 'ar' | 'en' | 'fr';

interface Conversation {
  id: string;
  tenant_id: string;
  channel: string;
  customer_name: string;
  last_message_time: string;
  tenant_name: string;
  agency_id: string | null;
  agency_name: string;
  message_count: number;
}

interface AnalyticsData {
  total_today: number;
  total_week: number;
  total_month: number;
  total_all: number;
  channels: { channel: string; count: number }[];
  agencies: { agency_id: string; agency_name: string; count: number }[];
  timeline: { date: string; channel: string; count: number }[];
  peak_hours: { hour: number; count: number }[];
}

interface MessagesUIProps {
  initialAnalytics?: AnalyticsData | null;
  initialConversations?: Conversation[];
  agencies?: { id: string; name: string }[];
  tenants?: { id: string; name: string; agency_id: string | null }[];
}

const DICTIONARY = {
  ar: {
    title: 'نظام مراقبة القنوات والمحادثات الموحد',
    subtitle: 'مراقبة وإحصاءات لحظية لبيانات وحركة الرسائل بدون كشف المحتوى الخصوصي أو أرقام الهواتف للمشتركين.',
    tabAnalytics: '📊 إحصاءات القنوات والتحليلات',
    tabConversations: '📋 سجل المحادثات المراقبة',
    kpiTodayMsgs: 'رسائل اليوم',
    kpiWeekMsgs: 'رسائل الأسبوع',
    kpiMonthMsgs: 'رسائل الشهر',
    kpiAllMsgs: 'إجمالي الرسائل (كل الوقت)',
    filterDays: 'فترة التحليل:',
    days7: 'آخر 7 أيام',
    days30: 'آخر 30 يوم',
    days90: 'آخر 90 يوم',
    chartChannels: 'توزيع حجم الرسائل حسب القنوات',
    chartTimeline: 'حركة الرسائل والنشاط اليومي',
    chartPeakHours: 'أوقات الذروة ونشاط المستخدمين (بالساعات)',
    colAgency: 'الوكالة',
    colClient: 'العميل',
    colChannel: 'القناة',
    colMsgCount: 'عدد الرسائل',
    colLastActivity: 'آخر نشاط',
    exportExcel: 'تصدير تقرير Excel 📥',
    noData: 'لا توجد بيانات حركة أو رسائل متوفرة في الفترة المحددة.',
    searchPlaceholder: 'بحث باسم العميل...',
    filterAgency: 'كل الوكالات',
    filterTenant: 'كل العملاء',
    filterChannel: 'كل القنوات',
    langAr: 'العربية',
    langEn: 'English',
    langFr: 'Français',
    prev: 'السابق',
    next: 'التالي',
    pageOf: 'صفحة {current} من {total}'
  },
  en: {
    title: 'Omnichannel Messages & Chats Monitor',
    subtitle: 'Real-time monitoring and metadata analysis with strict privacy and GDPR compliance.',
    tabAnalytics: '📊 Channel Analytics & Charts',
    tabConversations: '📋 Monitored Conversations',
    kpiTodayMsgs: "Today's Messages",
    kpiWeekMsgs: "This Week's Messages",
    kpiMonthMsgs: "This Month's Messages",
    kpiAllMsgs: 'Total Messages (All Time)',
    filterDays: 'Analysis Period:',
    days7: 'Last 7 Days',
    days30: 'Last 30 Days',
    days90: 'Last 90 Days',
    chartChannels: 'Message Volume by Channel',
    chartTimeline: 'Daily Traffic & Message Trends',
    chartPeakHours: 'Peak Traffic Hours (Hour of Day)',
    colAgency: 'Agency',
    colClient: 'Client',
    colChannel: 'Channel',
    colMsgCount: 'Messages Count',
    colLastActivity: 'Last Activity',
    exportExcel: 'Export Excel Report 📥',
    noData: 'No messaging traffic data available for the selected period.',
    searchPlaceholder: 'Search by client name...',
    filterAgency: 'All Agencies',
    filterTenant: 'All Clients',
    filterChannel: 'All Channels',
    langAr: 'العربية',
    langEn: 'English',
    langFr: 'Français',
    prev: 'Previous',
    next: 'Next',
    pageOf: 'Page {current} of {total}'
  },
  fr: {
    title: 'Moniteur de Messages & Discussions Omnicanal',
    subtitle: 'Suivi en temps réel et analyse des métadonnées dans le strict respect de la vie privée (RGPD).',
    tabAnalytics: '📊 Analyses des Canaux & Graphiques',
    tabConversations: '📋 Discussions Surveillées',
    kpiTodayMsgs: "Messages d'Aujourd'hui",
    kpiWeekMsgs: "Messages de la Semaine",
    kpiMonthMsgs: "Messages du Mois",
    kpiAllMsgs: 'Total des Messages (Tout Temps)',
    filterDays: 'Période d\'Analyse:',
    days7: '7 Derniers Jours',
    days30: '30 Derniers Jours',
    days90: '90 Derniers Jours',
    chartChannels: 'Volume de Messages par Canal',
    chartTimeline: 'Trafic Quotidien & Tendances',
    chartPeakHours: 'Heures de Pointe (Heure du Jour)',
    colAgency: 'Agence',
    colClient: 'Client',
    colChannel: 'Canal',
    colMsgCount: 'Nombre de Messages',
    colLastActivity: 'Dernière Activité',
    exportExcel: 'Exporter le Rapport Excel 📥',
    noData: 'Aucune donnée de trafic disponible pour la période sélectionnée.',
    searchPlaceholder: 'Rechercher par client...',
    filterAgency: 'Toutes les Agences',
    filterTenant: 'Tous les Clients',
    filterChannel: 'Tous les Canaux',
    langAr: 'العربية',
    langEn: 'English',
    langFr: 'Français',
    prev: 'Précédent',
    next: 'Suivant',
    pageOf: 'Page {current} sur {total}'
  }
} as const;

export function MessagesUI({
  initialAnalytics = null,
  initialConversations = [],
  agencies = [],
  tenants = []
}: MessagesUIProps) {
  const [lang, setLang] = useState<Lang>('ar');
  const [activeTab, setActiveTab] = useState<'analytics' | 'conversations'>('analytics');
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(initialAnalytics);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [search, setSearch] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [isPending, startTransition] = useTransition();

  const d = DICTIONARY[lang];
  const isRtl = lang === 'ar';
  const ITEMS_PER_PAGE = 15;

  // Fetch updated analytics when period changes
  useEffect(() => {
    let active = true;
    if (period !== 30 || analytics === null) {
      setIsLoadingAnalytics(true);
      fetch(`/api/master-admin/analytics?days=${period}`)
        .then((res) => res.json())
        .then((json) => {
          if (active && json.data) {
            setAnalytics(json.data);
          }
        })
        .catch((err) => console.error('Failed to load period analytics:', err))
        .finally(() => {
          if (active) setIsLoadingAnalytics(false);
        });
    }
    return () => {
      active = false;
    };
  }, [period]);

  // Pivot database timeline data for Recharts [ { date, whatsapp, messenger, instagram } ]
  const getTimelineData = () => {
    if (!analytics || !analytics.timeline) return [];
    const pivot: Record<string, any> = {};
    analytics.timeline.forEach((item) => {
      const date = item.date;
      const ch = (item.channel || 'whatsapp').toLowerCase();
      const count = Number(item.count) || 0;
      if (!pivot[date]) {
        pivot[date] = { date, whatsapp: 0, messenger: 0, instagram: 0 };
      }
      const chKey = ch === 'facebook' || ch === 'messenger' ? 'messenger' : ch;
      pivot[date][chKey] = (pivot[date][chKey] || 0) + count;
    });
    return Object.values(pivot).sort((a: any, b: any) => a.date.localeCompare(b.date));
  };

  const getPeakHoursData = () => {
    if (!analytics || !analytics.peak_hours) return [];
    return [...analytics.peak_hours].sort((a, b) => a.hour - b.hour);
  };

  const formatHour = (h: number) => {
    const isPm = h >= 12;
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    if (lang === 'ar') {
      return `${displayHour} ${isPm ? 'م' : 'ص'}`;
    }
    return `${displayHour} ${isPm ? 'PM' : 'AM'}`;
  };

  // GDPR compliant conversations filtering (strictly metadata only)
  const filteredConversations = initialConversations.filter((c) => {
    const term = search.toLowerCase();
    const matchesSearch = c.customer_name.toLowerCase().includes(term) || c.tenant_name.toLowerCase().includes(term);
    const matchesAgency = !agencyFilter || c.agency_id === agencyFilter;
    const matchesTenant = !tenantFilter || c.tenant_id === tenantFilter;
    const matchesChannel = !channelFilter || c.channel.toLowerCase() === channelFilter.toLowerCase();
    return matchesSearch && matchesAgency && matchesTenant && matchesChannel;
  });

  // Pagination for conversations
  const totalPages = Math.max(Math.ceil(filteredConversations.length / ITEMS_PER_PAGE), 1);
  const paginatedConversations = filteredConversations.slice(
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

  // Excel multi-sheet export using SheetJS
  const handleExportExcel = () => {
    if (!analytics) return;
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: General KPI Summary
      const summarySheetData = [
        { [isRtl ? 'المقياس' : 'Metric']: isRtl ? 'رسائل اليوم' : "Today's Messages", [isRtl ? 'القيمة' : 'Value']: analytics.total_today },
        { [isRtl ? 'المقياس' : 'Metric']: isRtl ? 'رسائل الأسبوع' : "This Week's Messages", [isRtl ? 'القيمة' : 'Value']: analytics.total_week },
        { [isRtl ? 'المقياس' : 'Metric']: isRtl ? 'رسائل الشهر' : "This Month's Messages", [isRtl ? 'القيمة' : 'Value']: analytics.total_month },
        { [isRtl ? 'المقياس' : 'Metric']: isRtl ? 'إجمالي الرسائل' : 'Total Messages (All Time)', [isRtl ? 'القيمة' : 'Value']: analytics.total_all },
      ];
      const ws1 = XLSX.utils.json_to_sheet(summarySheetData);
      XLSX.utils.book_append_sheet(wb, ws1, isRtl ? 'ملخص الإحصاءات' : 'Summary');

      // Sheet 2: Conversation detail list (GDPR Compliant, absolutely no messages or phone numbers)
      const convSheetData = filteredConversations.map((c) => ({
        [isRtl ? 'الوكالة' : 'Agency']: c.agency_name,
        [isRtl ? 'العميل' : 'Client']: c.tenant_name,
        [isRtl ? 'القناة' : 'Channel']: c.channel.toUpperCase(),
        [isRtl ? 'عدد الرسائل' : 'Messages Count']: c.message_count,
        [isRtl ? 'آخر نشاط' : 'Last Activity']: formatTimestamp(c.last_message_time)
      }));
      const ws2 = XLSX.utils.json_to_sheet(convSheetData);
      XLSX.utils.book_append_sheet(wb, ws2, isRtl ? 'المحادثات المراقبة' : 'Monitored Conversations');

      // Sheet 3: Channel volume distribution
      const channelSheetData = (analytics.channels || []).map((ch) => ({
        [isRtl ? 'القناة' : 'Channel']: ch.channel.toUpperCase(),
        [isRtl ? 'عدد الرسائل' : 'Messages Count']: ch.count
      }));
      const ws3 = XLSX.utils.json_to_sheet(channelSheetData);
      XLSX.utils.book_append_sheet(wb, ws3, isRtl ? 'توزيع القنوات' : 'Channel Distribution');

      XLSX.writeFile(wb, `Omnichannel_Analytics_Report_${period}_Days.xlsx`);
    } catch (err) {
      console.error('Failed to export Excel:', err);
    }
  };

  const getChannelColor = (channel: string) => {
    const ch = channel.toLowerCase();
    if (ch === 'whatsapp') return '#10b981'; // Emerald
    if (ch === 'messenger' || ch === 'facebook') return '#3b82f6'; // Blue
    if (ch === 'instagram') return '#a855f7'; // Purple
    return '#6b7280';
  };

  const getChannelBadge = (channel: string) => {
    const ch = channel.toLowerCase();
    if (ch === 'whatsapp') {
      return {
        className: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/15',
        icon: <Smartphone size={12} />,
        label: isRtl ? 'واتساب 📱' : 'WhatsApp 📱'
      };
    }
    if (ch === 'messenger' || ch === 'facebook') {
      return {
        className: 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/15',
        icon: <Facebook size={12} />,
        label: isRtl ? 'فيسبوك 📘' : 'Facebook 📘'
      };
    }
    if (ch === 'instagram') {
      return {
        className: 'bg-purple-500/10 text-purple-500 dark:text-purple-400 border border-purple-500/15',
        icon: <Instagram size={12} />,
        label: isRtl ? 'إنستغرام 📸' : 'Instagram 📸'
      };
    }
    return {
      className: 'bg-gray-500/10 text-gray-500 dark:text-gray-400 border border-gray-500/15',
      icon: <Layers size={12} />,
      label: channel.toUpperCase()
    };
  };

  const filteredTenantsList = tenants.filter(
    (t) => !agencyFilter || t.agency_id === agencyFilter
  );

  // Detect empty state truthfully
  const isDatabaseEmpty = !analytics || (
    analytics.total_today === 0 &&
    analytics.total_week === 0 &&
    analytics.total_month === 0 &&
    analytics.total_all === 0 &&
    (!analytics.timeline || analytics.timeline.length === 0) &&
    (!analytics.channels || analytics.channels.length === 0)
  );

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="p-6 space-y-6 min-h-screen text-[var(--text-main)] bg-[var(--bg-color)]">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-[var(--glass-border)]">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-main)] flex items-center gap-3">
            <MessageSquare className="text-[var(--accent-primary)]" size={32} />
            {d.title}
          </h1>
          <p className="text-[var(--text-dim)] mt-1 max-w-2xl text-sm">
            {d.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-end md:self-auto">
          {/* Export Excel Button */}
          {analytics && !isDatabaseEmpty && (
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md border border-emerald-500/20 transition-all text-sm cursor-pointer"
            >
              <FileSpreadsheet size={16} />
              <span>{d.exportExcel}</span>
            </button>
          )}

          {/* Lang Selector */}
          <div className="flex items-center gap-1 bg-[var(--bg-input)] p-1 rounded-xl border border-[var(--glass-border)]">
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
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-[var(--glass-border)] gap-2">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'analytics'
              ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] font-extrabold'
              : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-main)]'
          }`}
        >
          <BarChart3 size={16} />
          {d.tabAnalytics}
        </button>
        <button
          onClick={() => setActiveTab('conversations')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'conversations'
              ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] font-extrabold'
              : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-main)]'
          }`}
        >
          <Inbox size={16} />
          {d.tabConversations}
        </button>
      </div>

      {/* Database is Empty State */}
      {isDatabaseEmpty ? (
        <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-3xl p-16 text-center max-w-xl mx-auto my-12 flex flex-col items-center space-y-4 backdrop-blur-sm shadow-sm">
          <div className="p-4 bg-[var(--bg-input)] rounded-2xl text-[var(--accent-primary)] border border-[var(--glass-border)]">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-xl font-bold text-[var(--text-main)]">
            {isRtl ? 'لا توجد بيانات حركة حالياً' : 'No Message Traffic Available'}
          </h3>
          <p className="text-[var(--text-dim)] text-sm max-w-md">
            {d.noData}
          </p>
        </div>
      ) : (
        <>
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              
              {/* Analytics Timeframe Selector & KPI grid */}
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-[var(--card-bg)] p-4 rounded-2xl border border-[var(--glass-border)] shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-[var(--text-main)]">{d.filterDays}</span>
                  <div className="flex gap-1 bg-[var(--bg-input)] p-1 rounded-xl border border-[var(--glass-border)]">
                    <button
                      onClick={() => setPeriod(7)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        period === 7 ? 'bg-[var(--accent-primary)] text-white shadow-sm' : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      {d.days7}
                    </button>
                    <button
                      onClick={() => setPeriod(30)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        period === 30 ? 'bg-[var(--accent-primary)] text-white shadow-sm' : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      {d.days30}
                    </button>
                    <button
                      onClick={() => setPeriod(90)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        period === 90 ? 'bg-[var(--accent-primary)] text-white shadow-sm' : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      {d.days90}
                    </button>
                  </div>
                </div>

                {isLoadingAnalytics && (
                  <div className="flex items-center gap-2 text-xs text-[var(--accent-primary)] font-semibold">
                    <Clock className="animate-spin" size={14} />
                    <span>Loading analytics...</span>
                  </div>
                )}
              </div>

              {/* KPI Cards Grid */}
              {analytics && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Today */}
                  <div className="relative overflow-hidden bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--glass-border)] backdrop-blur-sm shadow-sm flex items-center justify-between">
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-wider">{d.kpiTodayMsgs}</p>
                      <h3 className="text-3xl font-extrabold text-[var(--text-main)]">{(analytics.total_today || 0).toLocaleString()}</h3>
                    </div>
                    <div className="p-3 bg-[var(--bg-input)] rounded-xl border border-[var(--glass-border)] text-[var(--accent-primary)]">
                      <Clock size={20} />
                    </div>
                  </div>

                  {/* Card 2: Week */}
                  <div className="relative overflow-hidden bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--glass-border)] backdrop-blur-sm shadow-sm flex items-center justify-between">
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-wider">{d.kpiWeekMsgs}</p>
                      <h3 className="text-3xl font-extrabold text-[var(--text-main)]">{(analytics.total_week || 0).toLocaleString()}</h3>
                    </div>
                    <div className="p-3 bg-[var(--bg-input)] rounded-xl border border-[var(--glass-border)] text-blue-500">
                      <TrendingUp size={20} />
                    </div>
                  </div>

                  {/* Card 3: Month */}
                  <div className="relative overflow-hidden bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--glass-border)] backdrop-blur-sm shadow-sm flex items-center justify-between">
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-wider">{d.kpiMonthMsgs}</p>
                      <h3 className="text-3xl font-extrabold text-[var(--text-main)]">{(analytics.total_month || 0).toLocaleString()}</h3>
                    </div>
                    <div className="p-3 bg-[var(--success-bg)] rounded-xl border border-[var(--success-bg)] text-[var(--success-text)]">
                      <Calendar size={20} />
                    </div>
                  </div>

                  {/* Card 4: All Time */}
                  <div className="relative overflow-hidden bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--glass-border)] backdrop-blur-sm shadow-sm flex items-center justify-between">
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-wider">{d.kpiAllMsgs}</p>
                      <h3 className="text-3xl font-extrabold text-[var(--text-main)]">{(analytics.total_all || 0).toLocaleString()}</h3>
                    </div>
                    <div className="p-3 bg-[var(--bg-input)] rounded-xl border border-[var(--glass-border)] text-purple-500 dark:text-purple-400">
                      <Layers size={20} />
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced Recharts Plots Section */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* 1. Daily Message Timeline (Span 8) */}
                <div className="lg:col-span-8 bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                  <div className="pb-4">
                    <h3 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
                      <TrendingUp size={16} className="text-[var(--accent-primary)]" />
                      {d.chartTimeline}
                    </h3>
                  </div>
                  
                  <div className="h-[300px] w-full">
                    {getTimelineData().length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-[var(--text-dim)]">
                        {isRtl ? 'لا توجد بيانات تفصيلية في هذه الفترة' : 'No timeline data for this timeframe.'}
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={getTimelineData()}>
                          <defs>
                            <linearGradient id="waGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="mesGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="insGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                          <XAxis dataKey="date" stroke="var(--text-dim)" fontSize={11} tickLine={false} />
                          <YAxis stroke="var(--text-dim)" fontSize={11} tickLine={false} />
                          <Tooltip
                            contentStyle={{ background: 'var(--bg-space-surface)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}
                            labelStyle={{ color: 'var(--text-main)', fontWeight: 'bold' }}
                          />
                          <Legend verticalAlign="top" height={36} />
                          <Area type="monotone" dataKey="whatsapp" name={isRtl ? 'واتساب' : 'WhatsApp'} stroke="#10b981" fillOpacity={1} fill="url(#waGrad)" strokeWidth={2} />
                          <Area type="monotone" dataKey="messenger" name={isRtl ? 'فيسبوك' : 'Messenger'} stroke="#3b82f6" fillOpacity={1} fill="url(#mesGrad)" strokeWidth={2} />
                          <Area type="monotone" dataKey="instagram" name={isRtl ? 'إنستغرام' : 'Instagram'} stroke="#a855f7" fillOpacity={1} fill="url(#insGrad)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* 2. Channels distribution comparison (Span 4) */}
                <div className="lg:col-span-4 bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                  <div className="pb-4">
                    <h3 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
                      <Layers size={16} className="text-blue-500" />
                      {d.chartChannels}
                    </h3>
                  </div>

                  <div className="h-[300px] w-full flex items-center justify-center">
                    {!analytics || !analytics.channels || analytics.channels.length === 0 ? (
                      <div className="text-sm text-[var(--text-dim)]">
                        {isRtl ? 'لا توجد بيانات قنوات' : 'No channel metrics.'}
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.channels} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" horizontal={false} />
                          <XAxis type="number" stroke="var(--text-dim)" fontSize={11} tickLine={false} />
                          <YAxis
                            dataKey="channel"
                            type="category"
                            stroke="var(--text-dim)"
                            fontSize={11}
                            tickFormatter={(v) => v.toUpperCase()}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{ background: 'var(--bg-space-surface)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}
                            labelStyle={{ color: 'var(--text-main)', fontWeight: 'bold' }}
                          />
                          <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                            {analytics.channels.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={getChannelColor(entry.channel)} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* 3. Peak traffic hours hourly distribution (Span 12) */}
                <div className="lg:col-span-12 bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-5 shadow-sm">
                  <div className="pb-4">
                    <h3 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
                      <Clock size={16} className="text-emerald-555" />
                      {d.chartPeakHours}
                    </h3>
                  </div>

                  <div className="h-[260px] w-full">
                    {getPeakHoursData().length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-[var(--text-dim)]">
                        {isRtl ? 'لا توجد إحصاءات لساعات الذروة بعد' : 'No peak hourly stats available.'}
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getPeakHoursData()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                          <XAxis
                            dataKey="hour"
                            stroke="var(--text-dim)"
                            fontSize={11}
                            tickFormatter={formatHour}
                            tickLine={false}
                          />
                          <YAxis stroke="var(--text-dim)" fontSize={11} tickLine={false} />
                          <Tooltip
                            contentStyle={{ background: 'var(--bg-space-surface)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}
                            labelStyle={{ color: 'var(--text-main)', fontWeight: 'bold' }}
                            formatter={(value) => [value, isRtl ? 'الرسائل' : 'Messages']}
                          />
                          <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]}>
                            {getPeakHoursData().map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.count > 10 ? '#a855f7' : '#6366f1'} // highlights high volume hours
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {activeTab === 'conversations' && (
            <div className="space-y-6">
              
              {/* Conversations filters bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-center bg-[var(--card-bg)] p-4 rounded-2xl border border-[var(--glass-border)] shadow-sm">
                
                {/* Search */}
                <div className="lg:col-span-4 relative">
                  <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-[var(--text-dim)]`}>
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
                <div className="lg:col-span-3 relative">
                  <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-[var(--text-dim)] pointer-events-none`}>
                    <Filter size={15} />
                  </div>
                  <select
                    value={agencyFilter}
                    onChange={(e) => {
                      setAgencyFilter(e.target.value);
                      setTenantFilter(''); // reset tenant
                      setCurrentPage(1);
                    }}
                    className={`w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl py-2 ${
                      isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
                    } text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)] transition-all appearance-none cursor-pointer`}
                  >
                    <option value="" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.filterAgency}</option>
                    {agencies.map((agency) => (
                      <option key={agency.id} value={agency.id} style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>
                        {agency.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tenant Filter */}
                <div className="lg:col-span-3 relative">
                  <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-[var(--text-dim)] pointer-events-none`}>
                    <User size={15} />
                  </div>
                  <select
                    value={tenantFilter}
                    onChange={(e) => {
                      setTenantFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className={`w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl py-2 ${
                      isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
                    } text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)] transition-all appearance-none cursor-pointer`}
                  >
                    <option value="" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.filterTenant}</option>
                    {filteredTenantsList.map((t) => (
                      <option key={t.id} value={t.id} style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Channel Filter */}
                <div className="lg:col-span-2 relative">
                  <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-[var(--text-dim)] pointer-events-none`}>
                    <Layers size={15} />
                  </div>
                  <select
                    value={channelFilter}
                    onChange={(e) => {
                      setChannelFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className={`w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl py-2 ${
                      isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
                    } text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)] transition-all appearance-none cursor-pointer`}
                  >
                    <option value="" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.filterChannel}</option>
                    <option value="whatsapp" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>WhatsApp 📱</option>
                    <option value="messenger" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>Facebook Messenger 📘</option>
                    <option value="instagram" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>Instagram 📸</option>
                  </select>
                </div>

              </div>

              {/* Conversations Table grid (strictly no raw contents or phone numbers) */}
              <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-4 overflow-hidden shadow-sm">
                
                <div className="overflow-x-auto min-h-[350px]">
                  <table className="w-full text-sm text-right border-collapse">
                    <thead>
                      <tr className="text-[var(--text-dim)] border-b border-[var(--glass-border)] text-xs font-semibold uppercase tracking-wider">
                        <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colAgency}</th>
                        <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colClient}</th>
                        <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colChannel}</th>
                        <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colMsgCount}</th>
                        <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colLastActivity}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--glass-border)]">
                      {paginatedConversations.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-24 text-center text-[var(--text-dim)] text-sm font-medium">
                            {isRtl ? 'لا توجد محادثات مطابقة لخيارات التصفية.' : 'No conversations match your filtering criteria.'}
                          </td>
                        </tr>
                      ) : (
                        paginatedConversations.map((c) => {
                          const chBadge = getChannelBadge(c.channel);

                          return (
                            <tr key={c.id} className="hover:bg-[var(--hover-bg)] transition-colors">
                              
                              {/* Agency Name */}
                              <td className={`py-4 px-3 font-semibold text-[var(--text-main)] ${isRtl ? 'text-right' : 'text-left'}`}>
                                <span className="bg-[var(--bg-input)] border border-[var(--glass-border)] px-2.5 py-1 rounded-lg text-xs">
                                  {c.agency_name}
                                </span>
                              </td>

                              {/* Client (Tenant) Name */}
                              <td className={`py-4 px-3 font-semibold text-[var(--text-main)] ${isRtl ? 'text-right' : 'text-left'}`}>
                                <span className="text-sm font-bold text-[var(--text-main)]">{c.tenant_name}</span>
                              </td>

                              {/* Channel Badge */}
                              <td className={`py-4 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${chBadge.className}`}>
                                  {chBadge.icon}
                                  <span>{chBadge.label}</span>
                                </span>
                              </td>

                              {/* Messages Count */}
                              <td className={`py-4 px-3 text-[var(--text-main)] font-bold ${isRtl ? 'text-right' : 'text-left'}`}>
                                <span className="bg-[var(--bg-input)] text-[var(--accent-primary)] border border-[var(--glass-border)] px-2 py-0.5 rounded-md text-xs font-extrabold">
                                  {(c.message_count || 0).toLocaleString()}
                                </span>
                              </td>

                              {/* Last Activity Time */}
                              <td className={`py-4 px-3 text-[var(--text-main)] font-medium ${isRtl ? 'text-right' : 'text-left'}`}>
                                <div className="flex items-center gap-2 justify-start">
                                  <Clock size={13} className="text-[var(--text-dim)]" />
                                  <span>{formatTimestamp(c.last_message_time)}</span>
                                </div>
                              </td>

                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {filteredConversations.length > ITEMS_PER_PAGE && (
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
          )}
        </>
      )}

    </div>
  );
}
