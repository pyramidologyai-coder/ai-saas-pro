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

const ACTION_LABELS: Record<string, { ar: string; en: string; fr: string }> = {
  'PLAN_CREATED': { ar: 'إضافة باقة', en: 'Plan Created', fr: 'Forfait Créé' },
  'PLAN_DELETED': { ar: 'حذف باقة', en: 'Plan Deleted', fr: 'Forfait Supprimé' },
  'PLAN_ACTIVATED': { ar: 'تفعيل باقة', en: 'Plan Activated', fr: 'Forfait Activé' },
  'PLAN_DEACTIVATED': { ar: 'تعطيل باقة', en: 'Plan Deactivated', fr: 'Forfait Désactivé' },
  'PLAN_PRICING_UPDATED': { ar: 'تعديل سعر', en: 'Price Updated', fr: 'Prix Mis à Jour' },
  'AGENCY_CREATED': { ar: 'إضافة وكالة', en: 'Agency Created', fr: 'Agence Créée' },
  'AGENCY_SUSPENDED_CASCADE': { ar: 'تعطيل وكالة وعملاءها', en: 'Agency + Clients Suspended', fr: 'Agence + Clients Suspendus' },
  'AGENCY_ACTIVATED_CASCADE': { ar: 'تفعيل وكالة وعملاءها', en: 'Agency + Clients Activated', fr: 'Agence + Clients Activés' },
  'SUSPEND_AGENCY': { ar: 'تعطيل وكالة (API)', en: 'Suspend Agency (API)', fr: 'Suspendre (API)' },
  'ACTIVATE_AGENCY': { ar: 'تفعيل وكالة (API)', en: 'Activate Agency (API)', fr: 'Activer (API)' },
  'MASTER_ADMIN_TOGGLE_TENANT': { ar: 'تعديل حالة عميل', en: 'Toggle Tenant', fr: 'Modifier Client' },
};

const getActionLabel = (action: string, lang: string) => {
  const key = action.toUpperCase();
  const label = ACTION_LABELS[key];
  if (!label) return action;
  return label[lang as keyof typeof label] || action;
};

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

  // High-contrast Theme-responsive action badge color mapper
  const getActionBadgeStyle = (action: string) => {
    const act = action.toLowerCase()
    if (act.includes('create') || act.includes('insert') || act.includes('activate')) {
      return {
        background: 'var(--success-bg, rgba(16, 185, 129, 0.1))',
        color: 'var(--success-text, #10b981)',
        border: '1px solid rgba(16, 185, 129, 0.2)'
      }
    }
    if (act.includes('delete') || act.includes('remove') || act.includes('suspend') || act.includes('revoke')) {
      return {
        background: 'var(--cyber-red-glow, rgba(239, 68, 68, 0.1))',
        color: 'var(--cyber-red, #ef4444)',
        border: '1px solid rgba(239, 68, 68, 0.2)'
      }
    }
    if (act.includes('update') || act.includes('edit') || act.includes('modify')) {
      return {
        background: 'var(--bg-input, rgba(59, 130, 246, 0.08))',
        color: 'var(--accent-primary, #6366f1)',
        border: '1px solid var(--glass-border, rgba(99, 102, 241, 0.2))'
      }
    }
    return {
      background: 'rgba(245, 158, 11, 0.08)',
      color: 'var(--accent-secondary, #8b5cf6)',
      border: '1px solid rgba(139, 92, 246, 0.2)'
    }
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="p-6 space-y-6 min-h-screen text-[var(--text-main)] bg-[var(--bg-color)]">
      
      {/* Detail JSON viewer overlay modal */}
      {selectedDetails && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-space-surface)] border border-[var(--glass-border)] rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--glass-border)] mb-4">
              <h3 className="font-bold text-[var(--text-main)] text-lg flex items-center gap-2">
                <FileText className="text-[var(--accent-primary)]" size={20} />
                {d.colDetails}
              </h3>
              <button 
                onClick={() => setSelectedDetails(null)}
                className="text-[var(--text-dim)] hover:text-[var(--text-main)] text-sm font-bold bg-[var(--bg-input)] hover:bg-[var(--hover-bg)] px-3 py-1.5 rounded-lg transition-all"
              >
                ✕
              </button>
            </div>
            <pre className="bg-[var(--bg-color)] p-4 rounded-xl border border-[var(--glass-border)] text-emerald-500 dark:text-emerald-400 text-xs font-mono overflow-auto max-h-[400px] text-left direction-ltr">
              {JSON.stringify(selectedDetails, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-[var(--glass-border)]">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-main)] flex items-center gap-3">
            <ShieldAlert className="text-[var(--cyber-red)]" size={32} />
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

      {/* Filters bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-center bg-[var(--card-bg)] p-4 rounded-2xl border border-[var(--glass-border)] shadow-sm">
        
        {/* Search */}
        <div className="lg:col-span-6 relative">
          <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-[var(--text-dim)]`}>
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
            className={`w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl py-2 ${
              isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'
            } text-sm text-[var(--text-main)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-primary)] transition-all`}
          />
        </div>

        {/* Action Type filter */}
        <div className="lg:col-span-3 relative">
          <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-[var(--text-dim)] pointer-events-none`}>
            <Filter size={15} />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value)
              setCurrentPage(1)
            }}
            className={`w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl py-2 ${
              isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
            } text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)] transition-all appearance-none cursor-pointer`}
          >
            <option value="" style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>{d.filterActionType}</option>
            {uniqueActions.map(action => (
              <option key={action} value={action} style={{ background: 'var(--bg-space-surface)', color: 'var(--text-main)' }}>
                {getActionLabel(action, lang)}
              </option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div className="lg:col-span-3 relative">
          <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-[var(--text-dim)]`}>
            <Calendar size={15} />
          </div>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value)
              setCurrentPage(1)
            }}
            className={`w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl py-2 ${
              isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
            } text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)] transition-all cursor-pointer`}
          />
        </div>

      </div>

      {/* Logs Table */}
      <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-4 overflow-hidden shadow-sm">
        
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-sm text-right border-collapse">
            <thead>
              <tr className="text-[var(--text-dim)] border-b border-[var(--glass-border)] text-xs font-semibold uppercase tracking-wider">
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colCreatedAt}</th>
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colAction}</th>
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colEntityType}</th>
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colEntityId}</th>
                <th className={`pb-3 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{d.colPerformedBy}</th>
                <th className="pb-3 px-3 text-center">{d.colDetails}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-24 text-center text-[var(--text-dim)] text-sm font-medium">
                    {d.noLogs}
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  return (
                    <tr key={log.id} className="hover:bg-[var(--hover-bg)] transition-colors">
                      
                      {/* Timestamp */}
                      <td className={`py-4 px-3 text-[var(--text-main)] font-medium ${isRtl ? 'text-right' : 'text-left'}`}>
                        <div className="flex items-center gap-2">
                          <Clock size={13} className="text-[var(--text-dim)]" />
                          <span>{formatTimestamp(log.created_at)}</span>
                        </div>
                      </td>

                      {/* Action Badge */}
                      <td className={`py-4 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>
                        <span 
                          style={getActionBadgeStyle(log.action)} 
                          className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                        >
                          {getActionLabel(log.action, lang)}
                        </span>
                      </td>

                      {/* Entity Type */}
                      <td className={`py-4 px-3 font-semibold text-[var(--text-main)] ${isRtl ? 'text-right' : 'text-left'}`}>
                        <div className="flex items-center gap-1.5">
                          <FileText size={14} className="text-[var(--accent-primary)] opacity-80" />
                          <span>{log.entity_type}</span>
                        </div>
                      </td>

                      {/* Entity ID */}
                      <td className={`py-4 px-3 font-mono text-xs text-[var(--text-dim)] ${isRtl ? 'text-right' : 'text-left'}`}>
                        {log.entity_id ? (log.entity_id.length > 8 ? `${log.entity_id.slice(0, 8)}...` : log.entity_id) : '—'}
                      </td>

                      {/* Performed By (Actor) */}
                      <td className={`py-4 px-3 text-[var(--text-main)] ${isRtl ? 'text-right' : 'text-left'}`}>
                        <div className="flex items-center gap-2">
                          <User size={13} className="text-[var(--text-dim)]" />
                          <span className="truncate max-w-[150px] font-mono text-xs text-[var(--text-dim)]">
                            {log.actor_id || d.system}
                          </span>
                        </div>
                      </td>

                      {/* Details Modal Trigger button */}
                      <td className="py-4 px-3 text-center">
                        {log.changes ? (
                          <button
                            onClick={() => setSelectedDetails(log.changes)}
                            className="p-1.5 bg-[var(--bg-input)] hover:bg-[var(--hover-bg)] border border-[var(--glass-border)] rounded-lg text-[var(--text-dim)] hover:text-[var(--text-main)] transition-all shadow-sm cursor-pointer"
                            aria-label="View Details"
                          >
                            <Eye size={15} />
                          </button>
                        ) : (
                          <span className="text-[var(--text-dim)] opacity-60">—</span>
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
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-[var(--glass-border)] mt-4 text-xs text-[var(--text-dim)]">
            <div>
              {d.pageOf.replace('{current}', String(currentPage)).replace('{total}', String(totalPages))}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-[var(--bg-input)] hover:bg-[var(--hover-bg)] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-[var(--glass-border)] text-[var(--text-main)] font-semibold transition-all flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft size={14} />
                {d.prev}
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
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
  )
}
