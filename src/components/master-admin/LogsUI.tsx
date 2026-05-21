'use client'

import React, { useState, useTransition } from 'react'
import {
  Search, Calendar, ShieldAlert, FileText,
  User, Clock, ChevronLeft, ChevronRight,
  Filter, Eye
} from 'lucide-react'

type Lang = 'ar' | 'en' | 'fr'

interface AuditLog {
  id: string
  action: string
  entity_type: string
  entity_id: string
  actor_id?: string
  changes?: any
  created_at: string
}

interface LogsUIProps {
  initialLogs?: AuditLog[]
}

const DICTIONARY = {
  ar: {
    title: 'سجلات المراقبة والأمان',
    subtitle: 'تتبع شامل وحي لكافة العمليات والأنشطة الإدارية الحساسة داخل نظام المنصة.',
    searchPlaceholder: 'بحث بـ الكيان أو الإجراء أو المستخدم...',
    filterActionType: 'جميع الإجراءات',
    filterDate: 'تصفية بالتاريخ',
    colAction: 'العملية',
    colEntityType: 'نوع الكيان',
    colEntityId: 'معرف الكيان',
    colPerformedBy: 'منفذ العملية',
    colDetails: 'تفاصيل التغيير',
    colCreatedAt: 'تاريخ العملية',
    noLogs: 'لا توجد سجلات مطابقة لخيارات التصفية.',
    prev: 'السابق',
    next: 'التالي',
    pageOf: 'صفحة {current} من {total}',
    langAr: 'العربية',
    langEn: 'English',
    langFr: 'Français',
    system: 'النظام تلقائياً'
  },
  en: {
    title: 'Audit & Security Logs',
    subtitle: 'Comprehensive and live tracking of all administrative operations and sensitive events.',
    searchPlaceholder: 'Search by entity, action or user...',
    filterActionType: 'All Actions',
    filterDate: 'Filter by Date',
    colAction: 'Action',
    colEntityType: 'Entity Type',
    colEntityId: 'Entity ID',
    colPerformedBy: 'Performed By',
    colDetails: 'Details',
    colCreatedAt: 'Created At',
    noLogs: 'No logs match your filtering criteria.',
    prev: 'Previous',
    next: 'Next',
    pageOf: 'Page {current} of {total}',
    langAr: 'العربية',
    langEn: 'English',
    langFr: 'Français',
    system: 'System'
  },
  fr: {
    title: 'Journaux d\'Audit & Sécurité',
    subtitle: 'Suivi complet et en direct de toutes les opérations administratives et événements sensibles.',
    searchPlaceholder: 'Rechercher par entité, action ou utilisateur...',
    filterActionType: 'Toutes les Actions',
    filterDate: 'Filtrer par Date',
    colAction: 'Action',
    colEntityType: 'Type d\'Entité',
    colEntityId: 'ID de l\'Entité',
    colPerformedBy: 'Effectué Par',
    colDetails: 'Détails',
    colCreatedAt: 'Créé le',
    noLogs: 'Aucun journal ne correspond à vos critères de filtrage.',
    prev: 'Précédent',
    next: 'Suivant',
    pageOf: 'Page {current} sur {total}',
    langAr: 'العربية',
    langEn: 'English',
    langFr: 'Français',
    system: 'Système'
  }
} as const

export function LogsUI({ initialLogs = [] }: LogsUIProps) {
  const [lang, setLang] = useState<Lang>('ar')
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedDetails, setSelectedDetails] = useState<any | null>(null)
  
  const [isPending, startTransition] = useTransition()

  const d = DICTIONARY[lang]
  const isRtl = lang === 'ar'
  const ITEMS_PER_PAGE = 50

  // 1. Gather all unique actions for the filter select dropdown
  const uniqueActions = Array.from(new Set(initialLogs.map(l => l.action.toLowerCase())))

  // 2. Filter logs locally based on search term, action type dropdown, and date pick
  const filteredLogs = initialLogs.filter(log => {
    const term = search.toLowerCase()
    
    // Search match: action, entity_type, actor_id (performed_by)
    const matchesSearch = 
      log.action.toLowerCase().includes(term) ||
      log.entity_type.toLowerCase().includes(term) ||
      (log.actor_id && log.actor_id.toLowerCase().includes(term))
      
    // Action dropdown match
    const matchesAction = !actionFilter || log.action.toLowerCase() === actionFilter.toLowerCase()
    
    // Date match: compares YYYY-MM-DD
    let matchesDate = true
    if (dateFilter) {
      const logDateString = new Date(log.created_at).toISOString().split('T')[0]
      matchesDate = logDateString === dateFilter
    }
    
    return matchesSearch && matchesAction && matchesDate
  })

  // 3. Paginate logs in blocks of 50
  const totalPages = Math.max(Math.ceil(filteredLogs.length / ITEMS_PER_PAGE), 1)
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  // Format timestamp beautifully with Arabic/English locale support
  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return '—'
      return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  // Action badge color mapper helper
  const getActionBadgeColor = (action: string) => {
    const act = action.toLowerCase()
    if (act.includes('create') || act.includes('insert') || act.includes('activate')) {
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
    }
    if (act.includes('delete') || act.includes('remove') || act.includes('suspend') || act.includes('revoke')) {
      return 'bg-red-500/10 text-red-400 border border-red-500/15'
    }
    if (act.includes('update') || act.includes('edit') || act.includes('modify')) {
      return 'bg-blue-500/10 text-blue-400 border border-blue-500/15'
    }
    return 'bg-amber-500/10 text-amber-400 border border-amber-500/15'
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="p-6 space-y-6 text-gray-100 min-h-screen bg-gray-900">
      
      {/* Detail JSON viewer overlay modal */}
      {selectedDetails && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-800 border border-gray-700/60 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative">
            <div className="flex justify-between items-center pb-3 border-b border-gray-700 mb-4">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <FileText className="text-emerald-400" size={20} />
                {d.colDetails}
              </h3>
              <button 
                onClick={() => setSelectedDetails(null)}
                className="text-gray-400 hover:text-white text-sm font-bold bg-gray-700/50 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-all"
              >
                ✕
              </button>
            </div>
            <pre className="bg-gray-950 p-4 rounded-xl border border-gray-900 text-emerald-400 text-xs font-mono overflow-auto max-h-[400px] text-left direction-ltr">
              {JSON.stringify(selectedDetails, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <ShieldAlert className="text-red-400" size={32} />
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
              lang === 'ar' ? 'bg-red-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            {d.langAr}
          </button>
          <button
            onClick={() => startTransition(() => setLang('en'))}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              lang === 'en' ? 'bg-red-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            {d.langEn}
          </button>
          <button
            onClick={() => startTransition(() => setLang('fr'))}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              lang === 'fr' ? 'bg-red-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            {d.langFr}
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-center bg-gray-850/30 p-4 rounded-2xl border border-gray-800/50">
        
        {/* Search */}
        <div className="lg:col-span-6 relative">
          <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-gray-500`}>
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder={d.searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setCurrentPage(1)
            }}
            className={`w-full bg-gray-800 border border-gray-700/60 rounded-xl py-2 ${
              isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'
            } text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 transition-all`}
          />
        </div>

        {/* Action Type filter */}
        <div className="lg:col-span-3 relative">
          <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-gray-500`}>
            <Filter size={15} />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value)
              setCurrentPage(1)
            }}
            className={`w-full bg-gray-800 border border-gray-700/60 rounded-xl py-2 ${
              isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
            } text-sm text-white focus:outline-none focus:border-red-500/50 transition-all appearance-none`}
          >
            <option value="">{d.filterActionType}</option>
            {uniqueActions.map(action => (
              <option key={action} value={action} className="capitalize">
                {action.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div className="lg:col-span-3 relative">
          <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-gray-500`}>
            <Calendar size={15} />
          </div>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value)
              setCurrentPage(1)
            }}
            className={`w-full bg-gray-800 border border-gray-700/60 rounded-xl py-2 ${
              isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
            } text-sm text-white focus:outline-none focus:border-red-500/50 transition-all`}
          />
        </div>

      </div>

      {/* Logs Table */}
      <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-4 overflow-hidden">
        
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-sm text-right border-collapse">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800 text-xs font-semibold uppercase tracking-wider">
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colCreatedAt}</th>
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colAction}</th>
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colEntityType}</th>
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colEntityId}</th>
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colPerformedBy}</th>
                <th className="pb-3 px-3 text-center">{d.colDetails}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-24 text-center text-gray-500 text-sm font-medium">
                    {d.noLogs}
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  return (
                    <tr key={log.id} className="hover:bg-gray-800/35 transition-colors">
                      
                      {/* Timestamp */}
                      <td className={`py-4 px-3 text-gray-300 font-medium ${isRtl ? 'text-right' : 'text-left'}`}>
                        <div className="flex items-center gap-2">
                          <Clock size={13} className="text-gray-500" />
                          <span>{formatTimestamp(log.created_at)}</span>
                        </div>
                      </td>

                      {/* Action Badge */}
                      <td className={`py-4 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getActionBadgeColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>

                      {/* Entity Type */}
                      <td className={`py-4 px-3 font-semibold text-white ${isRtl ? 'text-right' : 'text-left'}`}>
                        <div className="flex items-center gap-1.5">
                          <FileText size={14} className="text-red-400/80" />
                          <span>{log.entity_type}</span>
                        </div>
                      </td>

                      {/* Entity ID */}
                      <td className={`py-4 px-3 font-mono text-xs text-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}>
                        {log.entity_id || '—'}
                      </td>

                      {/* Performed By (Actor) */}
                      <td className={`py-4 px-3 text-gray-300 ${isRtl ? 'text-right' : 'text-left'}`}>
                        <div className="flex items-center gap-2">
                          <User size={13} className="text-gray-500" />
                          <span className="truncate max-w-[150px] font-mono text-xs">
                            {log.actor_id || d.system}
                          </span>
                        </div>
                      </td>

                      {/* Details Modal Trigger button */}
                      <td className="py-4 px-3 text-center">
                        {log.changes ? (
                          <button
                            onClick={() => setSelectedDetails(log.changes)}
                            className="p-1.5 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-all shadow-sm"
                            aria-label="View Details"
                          >
                            <Eye size={15} />
                          </button>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>

                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls bar */}
        {filteredLogs.length > ITEMS_PER_PAGE && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-800 mt-4 text-xs text-gray-400">
            <div>
              {d.pageOf.replace('{current}', String(currentPage)).replace('{total}', String(totalPages))}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-gray-850 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-gray-700/50 text-white font-semibold transition-all flex items-center gap-1"
              >
                <ChevronLeft size={14} />
                {d.prev}
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
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
  )
}
