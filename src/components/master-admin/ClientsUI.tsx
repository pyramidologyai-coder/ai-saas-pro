'use client'

import React, { useState, useMemo } from 'react';
import { Search, Building2, Calendar, MessageCircle, Activity, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

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
    empty: 'لا يوجد عملاء'
  },
  en: {
    dir: 'ltr' as const,
    title: 'All Clients',
    searchPlaceholder: 'Search by client name...',
    allStatus: 'All Statuses',
    allPlans: 'All Plans',
    allAgencies: 'All Agencies',
    direct: 'Direct',
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
    empty: 'No clients found'
  },
  fr: {
    dir: 'ltr' as const,
    title: 'Tous les Clients',
    searchPlaceholder: 'Rechercher un client...',
    allStatus: 'Tous les statuts',
    allPlans: 'Tous les forfaits',
    allAgencies: 'Toutes les agences',
    direct: 'Direct',
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
    empty: 'Aucun client trouvé'
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
    if (status === 'active') return { bg: 'bg-green-500/20', text: 'text-green-400', label: t.active };
    if (status === 'suspended') return { bg: 'bg-red-500/20', text: 'text-red-400', label: t.suspended };
    return { bg: 'bg-gray-500/20', text: 'text-gray-400', label: t.inactive };
  };

  return (
    <div dir={t.dir} className="p-6 space-y-6 text-white min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-indigo-400">{t.title}</h1>
          <p className="text-gray-400 text-sm mt-1">{filteredClients.length} {t.title}</p>
        </div>
        
        <div className="flex gap-2">
          {VALID_LANGS.map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${lang === l ? 'bg-indigo-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-gray-800/80 px-3 py-2 rounded-xl border border-gray-700 focus-within:border-indigo-500 transition-colors">
          <Search size={18} className="text-gray-400" />
          <input 
            type="text" 
            placeholder={t.searchPlaceholder} 
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-gray-500"
          />
        </div>

        <select 
          value={filterStatus} 
          onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
          className="bg-gray-800/80 border border-gray-700 text-gray-300 text-sm rounded-xl px-4 py-2.5 outline-none min-w-[140px]"
        >
          <option value="all">{t.allStatus}</option>
          <option value="active">{t.active}</option>
          <option value="suspended">{t.suspended}</option>
          <option value="inactive">{t.inactive}</option>
        </select>

        <select 
          value={filterPlan} 
          onChange={(e) => { setFilterPlan(e.target.value); setCurrentPage(1); }}
          className="bg-gray-800/80 border border-gray-700 text-gray-300 text-sm rounded-xl px-4 py-2.5 outline-none min-w-[140px]"
        >
          <option value="all">{t.allPlans}</option>
          {uniquePlans.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select 
          value={filterAgency} 
          onChange={(e) => { setFilterAgency(e.target.value); setCurrentPage(1); }}
          className="bg-gray-800/80 border border-gray-700 text-gray-300 text-sm rounded-xl px-4 py-2.5 outline-none min-w-[140px]"
        >
          <option value="all">{t.allAgencies}</option>
          {uniqueAgencies.map(a => <option key={a} value={a}>{a === 'Direct' ? t.direct : a}</option>)}
        </select>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/30 text-gray-400">
                <th className={`py-4 px-4 font-medium ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>{t.name}</th>
                <th className={`py-4 px-4 font-medium ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>{t.type}</th>
                <th className={`py-4 px-4 font-medium ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>{t.plan}</th>
                <th className={`py-4 px-4 font-medium ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>{t.status}</th>
                <th className={`py-4 px-4 font-medium ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>{t.agency}</th>
                <th className={`py-4 px-4 font-medium ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>{t.endDate}</th>
                <th className={`py-4 px-4 font-medium ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>{t.messages}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {paginatedClients.map(c => {
                const status = getStatusBadge(c.status);
                const isUnlimited = c.messages_limit === -1;
                const msgUsed = c.messages_used || 0;
                const msgLimit = c.messages_limit || 0;
                const percent = isUnlimited ? 0 : msgLimit > 0 ? Math.min((msgUsed / msgLimit) * 100, 100) : 0;
                
                return (
                  <tr key={c.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className={`py-4 px-4 font-semibold text-white ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>{c.name}</td>
                    <td className={`py-4 px-4 text-gray-400 ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>{getTypeTranslation(c.type)}</td>
                    <td className={`py-4 px-4 text-indigo-400 font-medium ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>{c.plan_type}</td>
                    <td className={`py-4 px-4 ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${status.bg} ${status.text}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className={`py-4 px-4 text-gray-300 ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-gray-500" />
                        {c.agency_name || t.direct}
                      </div>
                    </td>
                    <td className={`py-4 px-4 text-gray-400 ${t.dir === 'ltr' ? 'text-left' : 'text-right'}`}>
                      {c.end_date ? new Date(c.end_date).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US') : '—'}
                    </td>
                    <td className={`py-4 px-4 ${t.dir === 'ltr' ? 'text-left' : 'text-right'} min-w-[150px]`}>
                      {isUnlimited ? (
                         <span className="text-green-400 font-medium">∞</span>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 font-medium w-12">{msgUsed}/{msgLimit}</span>
                          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden flex-1">
                            <div 
                              className={`h-full rounded-full ${percent > 90 ? 'bg-red-500' : percent > 75 ? 'bg-orange-500' : 'bg-indigo-500'}`} 
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
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    {t.empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-800 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {t.page} {currentPage} {t.of} {totalPages}
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {t.dir === 'rtl' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50 transition-colors"
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
