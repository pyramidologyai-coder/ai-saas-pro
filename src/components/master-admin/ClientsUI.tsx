'use client'

import React, { useState, useMemo } from 'react';
import { Search, Building2, Calendar, MessageCircle, Activity, Filter, ChevronLeft, ChevronRight, Download } from 'lucide-react';

const VALID_LANGS = ['ar', 'en', 'fr'] as const;
type Lang = typeof VALID_LANGS[number];

const translations = {
  ar: {
    dir: 'rtl' as const,
    title: 'جميع العملاء (العيادات والمطاعم)',
    searchPlaceholder: 'بحث باسم العميل...',
    allStatus: 'كل الحالات',
    allPlans: 'كل الباقات',
    allAgencies: 'كل الوكالات',
    direct: 'مباشر (Direct)',
    suspendedReseller: 'وكالة موقوفة',
    name: 'الاسم',
    type: 'النوع',
    plan: 'الباقة',
    status: 'الحالة',
    agency: 'الوكالة',
    endDate: 'تاريخ الانتهاء',
    messages: 'الرسائل',
    active: 'نشط',
    suspended: 'موقوف',
    inactive: 'غير نشط',
    clinic: 'عيادة',
    restaurant: 'مطعم',
    real_estate: 'عقارات',
    salon: 'صالون',
    car_rental: 'سيارات',
    ecommerce: 'متجر',
    prev: 'السابق',
    next: 'التالي',
    page: 'صفحة',
    of: 'من',
    empty: 'لا يوجد عملاء',
    exportCsv: 'تصدير البيانات (CSV)',
    agencyBadge: 'وكالة 🏢'
  },
  en: {
    dir: 'ltr' as const,
    title: 'All Clients',
    searchPlaceholder: 'Search by client name...',
    allStatus: 'All Statuses',
    allPlans: 'All Plans',
    allAgencies: 'All Agencies',
    direct: 'Direct',
    suspendedReseller: 'Suspended Reseller',
    name: 'Name',
    type: 'Type',
    plan: 'Plan',
    status: 'Status',
    agency: 'Agency',
    endDate: 'End Date',
    messages: 'Messages',
    active: 'Active',
    suspended: 'Suspended',
    inactive: 'Inactive',
    clinic: 'Clinic',
    restaurant: 'Restaurant',
    real_estate: 'Real Estate',
    salon: 'Salon',
    car_rental: 'Car Rental',
    ecommerce: 'E-commerce',
    prev: 'Prev',
    next: 'Next',
    page: 'Page',
    of: 'of',
    empty: 'No clients found',
    exportCsv: 'Export to CSV',
    agencyBadge: 'Agency 🏢'
  },
  fr: {
    dir: 'ltr' as const,
    title: 'Tous les Clients',
    searchPlaceholder: 'Rechercher un client...',
    allStatus: 'Tous les statuts',
    allPlans: 'Tous les forfaits',
    allAgencies: 'Toutes les agences',
    direct: 'Direct',
    suspendedReseller: 'Agence Suspendue',
    name: 'Nom',
    type: 'Type',
    plan: 'Forfait',
    status: 'Statut',
    agency: 'Agence',
    endDate: 'Date de fin',
    messages: 'Messages',
    active: 'Actif',
    suspended: 'Suspendu',
    inactive: 'Inactif',
    clinic: 'Clinique',
    restaurant: 'Restaurant',
    real_estate: 'Immobilier',
    salon: 'Salon',
    car_rental: 'Location de voitures',
    ecommerce: 'E-commerce',
    prev: 'Précédent',
    next: 'Suivant',
    page: 'Page',
    of: 'sur',
    empty: 'Aucun client trouvé',
    exportCsv: 'Exporter en CSV',
    agencyBadge: 'Agence 🏢'
  }
} as const;

interface ClientData {
  id: string;
  name: string;
  type: string;
  plan_type: string;
  status: string;
  end_date?: string | null;
  messages_used?: number;
  messages_limit?: number;
  agency_name?: string;
  agency_status?: string | null;
  agency_id?: string | null;
  record_type?: string | null;
}

export function ClientsUI({ initialClients }: { initialClients: ClientData[] }) {
  const [lang, setLang] = useState<Lang>('ar');
  const t = translations[lang];

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterAgency, setFilterAgency] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const uniqueAgencies = useMemo(() => {
    const agencies = new Set(initialClients.map(c => c.agency_name || 'Direct'));
    return Array.from(agencies).sort();
  }, [initialClients]);

  const uniquePlans = useMemo(() => {
    const plans = new Set(initialClients.map(c => c.plan_type || 'free'));
    return Array.from(plans).sort();
  }, [initialClients]);

  const filteredClients = useMemo(() => {
    return initialClients.filter(c => {
      const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
      const matchesPlan = filterPlan === 'all' || c.plan_type === filterPlan;
      const agencyName = c.agency_name || 'Direct';
      const matchesAgency = filterAgency === 'all' || agencyName === filterAgency;
      return matchesSearch && matchesStatus && matchesPlan && matchesAgency;
    });
  }, [initialClients, search, filterStatus, filterPlan, filterAgency]);

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage) || 1;
  const paginatedClients = filteredClients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getTypeTranslation = (type: string) => {
    const key = type as keyof typeof t;
    return t[key] || type;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') return { bg: 'bg-[var(--success-bg)]', text: 'text-[var(--success-text)]', border: 'border-[var(--success-text)]/20', label: t.active };
    if (status === 'suspended') return { bg: 'bg-[var(--cyber-red-glow)]', text: 'text-[var(--cyber-red)]', border: 'border-[var(--cyber-red)]/20', label: t.suspended };
    return { bg: 'bg-[var(--bg-input)]', text: 'text-[var(--text-dim)]', border: 'border-[var(--glass-border)]', label: t.inactive };
  };

  const handleExport = () => {
    const headers = [
      lang === 'ar' ? 'الاسم' : lang === 'fr' ? 'Nom' : 'Name',
      lang === 'ar' ? 'النوع' : lang === 'fr' ? 'Type' : 'Type',
      lang === 'ar' ? 'الباقة' : lang === 'fr' ? 'Forfait' : 'Plan',
      lang === 'ar' ? 'الحالة' : lang === 'fr' ? 'Statut' : 'Status',
      lang === 'ar' ? 'الوكالة' : lang === 'fr' ? 'Agence' : 'Agency',
      lang === 'ar' ? 'حالة الوكالة' : lang === 'fr' ? 'Statut de l\'agence' : 'Agency Status',
      lang === 'ar' ? 'الرسائل المستخدمة' : lang === 'fr' ? 'Messages utilisés' : 'Messages Used',
      lang === 'ar' ? 'حد الرسائل' : lang === 'fr' ? 'Limite de messages' : 'Messages Limit',
      lang === 'ar' ? 'تاريخ الانضمام' : lang === 'fr' ? 'Date d\'inscription' : 'Joined Date'
    ];
    
    const rows = filteredClients.map(c => [
      c.name || '',
      c.type || '',
      c.record_type === 'agency' ? (lang === 'ar' ? 'وكالة 🏢' : lang === 'fr' ? 'Agence 🏢' : 'Agency 🏢') : (c.plan_type || ''),
      c.status || '',
      c.record_type === 'agency' ? (lang === 'ar' ? 'وكالة 🏢' : lang === 'fr' ? 'Agence 🏢' : 'Agency 🏢') : (c.agency_name || (lang === 'ar' ? 'مباشر' : 'Direct')),
      c.record_type === 'agency' ? (lang === 'ar' ? 'وكالة 🏢' : lang === 'fr' ? 'Agence 🏢' : 'Agency 🏢') : (c.agency_id ? (c.agency_status || 'active') : (lang === 'ar' ? 'مباشر' : 'Direct')),
      c.messages_used || 0,
      c.messages_limit === -1 ? '∞' : (c.messages_limit || 0),
      c.end_date ? new Date(c.end_date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US') : ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clients_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div dir={t.dir} className="p-6 space-y-6 text-[var(--text-main)] min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--text-main)] to-indigo-400">{t.title}</h1>
          <p className="text-[var(--text-dim)] text-sm mt-1">{filteredClients.length} {t.title}</p>
        </div>
        
        <div className="flex gap-2">
          {VALID_LANGS.map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${lang === l ? 'bg-indigo-500 text-white' : 'bg-[var(--bg-input)] text-[var(--text-dim)] hover:bg-[var(--hover-bg)] border border-[var(--glass-border)]'}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-4 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-[var(--bg-input)] px-3 py-2 rounded-xl border border-[var(--glass-border)] focus-within:border-indigo-500 transition-colors">
          <Search size={18} className="text-[var(--text-dim)]" />
          <input 
            type="text" 
            placeholder={t.searchPlaceholder} 
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="bg-transparent border-none outline-none text-sm w-full text-[var(--text-main)] placeholder-[var(--text-dim)]/50"
          />
        </div>

        <select 
          value={filterStatus} 
          onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
          className="bg-[var(--bg-input)] border border-[var(--glass-border)] text-[var(--text-main)] text-sm rounded-xl px-4 py-2.5 outline-none min-w-[140px]"
        >
          <option value="all">{t.allStatus}</option>
          <option value="active">{t.active}</option>
          <option value="suspended">{t.suspended}</option>
          <option value="inactive">{t.inactive}</option>
        </select>

        <select 
          value={filterPlan} 
          onChange={(e) => { setFilterPlan(e.target.value); setCurrentPage(1); }}
          className="bg-[var(--bg-input)] border border-[var(--glass-border)] text-[var(--text-main)] text-sm rounded-xl px-4 py-2.5 outline-none min-w-[140px]"
        >
          <option value="all">{t.allPlans}</option>
          {uniquePlans.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select 
          value={filterAgency} 
          onChange={(e) => { setFilterAgency(e.target.value); setCurrentPage(1); }}
          className="bg-[var(--bg-input)] border border-[var(--glass-border)] text-[var(--text-main)] text-sm rounded-xl px-4 py-2.5 outline-none min-w-[140px]"
        >
          <option value="all">{t.allAgencies}</option>
          {uniqueAgencies.map(a => <option key={a} value={a}>{a === 'Direct' ? t.direct : a}</option>)}
        </select>

        <button 
          onClick={handleExport}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold rounded-xl px-5 py-2.5 outline-none transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 shrink-0"
        >
          <Download size={16} />
          {t.exportCsv}
        </button>
      </div>

      <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--glass-border)] bg-[var(--bg-input)] text-[var(--text-dim)]">
                <th className={`py-4 px-4 font-medium ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>{t.name}</th>
                <th className={`py-4 px-4 font-medium ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>{t.type}</th>
                <th className={`py-4 px-4 font-medium ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>{t.plan}</th>
                <th className={`py-4 px-4 font-medium ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>{t.status}</th>
                <th className={`py-4 px-4 font-medium ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>{t.agency}</th>
                <th className={`py-4 px-4 font-medium ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>{t.endDate}</th>
                <th className={`py-4 px-4 font-medium ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>{t.messages}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]">
              {paginatedClients.map(c => {
                const status = getStatusBadge(c.status);
                const isUnlimited = c.messages_limit === -1;
                const msgUsed = c.messages_used || 0;
                const msgLimit = c.messages_limit || 0;
                const percent = isUnlimited ? 0 : msgLimit > 0 ? Math.min((msgUsed / msgLimit) * 100, 100) : 0;
                
                return (
                  <tr key={c.id} className="hover:bg-[var(--hover-bg)] transition-colors">
                    <td className={`py-4 px-4 font-semibold text-[var(--text-main)] ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>{c.name}</td>
                    <td className={`py-4 px-4 text-[var(--text-dim)] ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>{getTypeTranslation(c.type)}</td>
                    <td className={`py-4 px-4 text-indigo-400 font-medium ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>
                      {c.record_type === 'agency' ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--bg-input)] text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/20">
                          {t.agencyBadge}
                        </span>
                      ) : (
                        c.plan_type
                      )}
                    </td>
                    <td className={`py-4 px-4 ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${status.bg} ${status.text} ${status.border || 'border-[var(--glass-border)]'}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className={`py-4 px-4 text-[var(--text-dim)] ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-[var(--text-dim)] shrink-0" />
                        {c.record_type === 'agency' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--bg-input)] text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/20">
                            {t.agencyBadge}
                          </span>
                        ) : !c.agency_id ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--bg-input)] text-[var(--text-dim)] border border-[var(--glass-border)]">
                            {t.direct}
                          </span>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-medium text-[var(--text-main)]">{c.agency_name}</span>
                            {c.agency_status === 'suspended' && (
                              <span className="text-[10px] font-bold bg-[var(--cyber-red-glow)] text-[var(--cyber-red)] px-1.5 py-0.5 rounded border border-[var(--cyber-red)]/20 w-fit mt-1">
                                {t.suspendedReseller}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className={`py-4 px-4 text-[var(--text-dim)] ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>
                      {c.end_date ? new Date(c.end_date).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US') : '—'}
                    </td>
                    <td className={`py-4 px-4 ${t.dir === 'ltr' ? 'text-left' : 'text-right'} min-w-[150px]`}>
                      {isUnlimited ? (
                         <span className="text-[var(--success-text)] font-medium">∞</span>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-[var(--text-dim)] font-medium w-12">{msgUsed}/{msgLimit}</span>
                          <div className="w-full h-1.5 bg-[var(--bg-input)] rounded-full overflow-hidden flex-1">
                            <div 
                              className={`h-full rounded-full ${percent > 90 ? 'bg-[var(--cyber-red)]' : percent > 75 ? 'bg-amber-500' : 'bg-[var(--accent-primary)]'}`} 
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {paginatedClients.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--text-dim)]">
                    {t.empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-[var(--glass-border)] flex items-center justify-between">
            <span className="text-sm text-[var(--text-dim)]">
              {t.page} {currentPage} {t.of} {totalPages}
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-[var(--bg-input)] text-[var(--text-dim)] hover:bg-[var(--hover-bg)] border border-[var(--glass-border)] disabled:opacity-50 transition-colors"
              >
                {t.dir === 'rtl' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-[var(--bg-input)] text-[var(--text-dim)] hover:bg-[var(--hover-bg)] border border-[var(--glass-border)] disabled:opacity-50 transition-colors"
              >
                {t.dir === 'rtl' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
