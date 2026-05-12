'use client'

import React, {
  useState,
  useCallback,
  useEffect
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  ArrowLeft,
  Building2,
  Users,
  MessageCircle,
  Calendar,
  Phone,
  Globe,
  Percent,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const VALID_LANGS = ['ar', 'en', 'fr'] as const
type Lang = typeof VALID_LANGS[number]

const translations = {
  ar: {
    dir: 'rtl' as const,
    back: 'رجوع',
    agencyDetails: 'تفاصيل الوكالة',
    plan: 'الباقة',
    clients: 'العملاء',
    messages: 'الرسائل',
    unlimited: 'غير محدود',
    joinDate: 'تاريخ الانضمام',
    whatsapp: 'واتساب',
    commission: 'العمولة',
    domain: 'الدومين',
    status: 'الحالة',
    active: 'نشطة',
    suspended: 'موقوفة',
    inactive: 'غير نشطة',
    suspend: 'تعطيل',
    activate: 'تفعيل',
    confirmSuspend: 'هل أنت متأكد من تعطيل هذه الوكالة؟',
    confirmActivate: 'هل أنت متأكد من تفعيل هذه الوكالة؟',
    confirm: 'تأكيد',
    cancel: 'إلغاء',
    processing: 'جاري التنفيذ...',
    error: 'حدث خطأ',
    notSet: 'غير محدد',
    locale: 'ar-SA'
  },
  en: {
    dir: 'ltr' as const,
    back: 'Back',
    agencyDetails: 'Agency Details',
    plan: 'Plan',
    clients: 'Clients',
    messages: 'Messages',
    unlimited: 'Unlimited',
    joinDate: 'Join Date',
    whatsapp: 'WhatsApp',
    commission: 'Commission',
    domain: 'Domain',
    status: 'Status',
    active: 'Active',
    suspended: 'Suspended',
    inactive: 'Inactive',
    suspend: 'Suspend',
    activate: 'Activate',
    confirmSuspend: 'Are you sure you want to suspend this agency?',
    confirmActivate: 'Are you sure you want to activate this agency?',
    confirm: 'Confirm',
    cancel: 'Cancel',
    processing: 'Processing...',
    error: 'An error occurred',
    notSet: 'Not set',
    locale: 'en-US'
  },
  fr: {
    dir: 'ltr' as const,
    back: 'Retour',
    agencyDetails: "Détails de l'agence",
    plan: 'Forfait',
    clients: 'Clients',
    messages: 'Messages',
    unlimited: 'Illimité',
    joinDate: "Date d'adhésion",
    whatsapp: 'WhatsApp',
    commission: 'Commission',
    domain: 'Domaine',
    status: 'Statut',
    active: 'Active',
    suspended: 'Suspendue',
    inactive: 'Inactive',
    suspend: 'Suspendre',
    activate: 'Activer',
    confirmSuspend: 'Êtes-vous sûr de suspendre cette agence?',
    confirmActivate: "Êtes-vous sûr d'activer cette agence?",
    confirm: 'Confirmer',
    cancel: 'Annuler',
    processing: 'En cours...',
    error: "Une erreur s'est produite",
    notSet: 'Non défini',
    locale: 'fr-FR'
  }
} as const

const PLAN_BADGES = {
  starter: {
    bg: 'bg-gray-500/20',
    text: 'text-gray-400',
    label: 'Starter'
  },
  growth: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    label: 'Growth'
  },
  pro: {
    bg: 'bg-purple-500/20',
    text: 'text-purple-400',
    label: 'Pro'
  },
  vip: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    label: 'VIP'
  }
} as const

function formatDate(
  dateStr: string,
  locale: string
): string {
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '—'
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch { return '—' }
}

interface AgencyData {
  id: string
  name: string
  plan_type: string
  subscription_status: string
  created_at: string
  whatsapp_number?: string | null
  messages_used?: number | null
  messages_limit?: number | null
  custom_domain?: string | null
  logo_url?: string | null
}

interface AgencyDetailsUIProps {
  agency: AgencyData
  tenantsCount: number
  commissionRate: number
  initialLang: Lang
}

export function AgencyDetailsUI({
  agency,
  tenantsCount,
  commissionRate,
  initialLang
}: AgencyDetailsUIProps) {

  const router = useRouter()

  const [currentLang, setCurrentLang] =
    useState<Lang>(initialLang)
  const t = translations[currentLang]

  const [isProcessing, setIsProcessing] =
    useState(false)
  const [error, setError] =
    useState<string | null>(null)
  const [showModal, setShowModal] =
    useState(false)
  const [pendingAction, setPendingAction] =
    useState<'suspend' | 'activate' | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && showModal) {
        setShowModal(false)
        setPendingAction(null)
        setError(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener(
        'keydown', handleKeyDown
      )
    }
  }, [showModal])

  const handleAction = useCallback(
    async (type: 'suspend' | 'activate') => {
      if (!UUID_REGEX.test(agency.id)) return
      if (isProcessing) return

      setIsProcessing(true)
      setError(null)

      try {
        const res = await fetch(
          `/api/agencies/${type}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              agencyId: agency.id
            })
          }
        )

        if (res.ok) {
          setShowModal(false)
          setPendingAction(null)
          router.refresh()
        } else {
          setError(translations[currentLang].error)
        }
      } catch {
        setError(translations[currentLang].error)
      } finally {
        setIsProcessing(false)
      }
    },
    [agency.id, isProcessing, router, currentLang]
  )

  const messagesUsed =
    typeof agency.messages_used === 'number'
      ? agency.messages_used : 0
  const messagesLimit =
    typeof agency.messages_limit === 'number'
      ? agency.messages_limit : 0
  const isUnlimited = messagesLimit === -1
  const messagesPercent = isUnlimited ? 0
    : messagesLimit > 0
      ? Math.min(
          (messagesUsed / messagesLimit) * 100,
          100
        )
      : 0

  const planKey = agency.plan_type as
    keyof typeof PLAN_BADGES
  const planBadge =
    PLAN_BADGES[planKey] ?? PLAN_BADGES.starter

  const statusConfig = {
    active: {
      bg: 'bg-green-500/20',
      text: 'text-green-400',
      label: t.active
    },
    suspended: {
      bg: 'bg-red-500/20',
      text: 'text-red-400',
      label: t.suspended
    },
    inactive: {
      bg: 'bg-gray-500/20',
      text: 'text-gray-400',
      label: t.inactive
    }
  }

  const statusKey = agency.subscription_status as
    keyof typeof statusConfig
  const statusBadge =
    statusConfig[statusKey]
    ?? statusConfig.inactive

  const isActive =
    agency.subscription_status === 'active'
  const isSuspended =
    agency.subscription_status === 'suspended'

  const BackArrow = t.dir === 'rtl'
    ? ArrowRight : ArrowLeft

  return (
    <div dir={t.dir} className="p-6 space-y-6">

      {showModal && pendingAction && (
        <div
          className="fixed inset-0 bg-black/60
            flex items-center justify-center
            z-50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title">
          <div
            className="bg-gray-800 rounded-xl
              p-6 max-w-sm w-full mx-4
              border border-gray-700 shadow-2xl"
            dir={t.dir}>
            <h3
              id="modal-title"
              className="text-white font-semibold
                text-lg mb-2">
              {pendingAction === 'suspend'
                ? t.suspend : t.activate}
            </h3>
            <p className="text-gray-400
              text-sm mb-4">
              {pendingAction === 'suspend'
                ? t.confirmSuspend
                : t.confirmActivate}
            </p>
            {error && (
              <p className="text-red-400 text-sm
                mb-3 p-2 bg-red-500/10 rounded-lg"
                role="alert">
                {error}
              </p>
            )}
            <div className={`flex gap-3 ${
              t.dir === 'rtl'
                ? 'justify-start'
                : 'justify-end'
            }`}>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false)
                  setPendingAction(null)
                  setError(null)
                }}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg
                  bg-gray-700 text-gray-300
                  hover:bg-gray-600 text-sm
                  transition-colors
                  disabled:opacity-50">
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() =>
                  handleAction(pendingAction)
                }
                className={`px-4 py-2 rounded-lg
                  text-white text-sm
                  transition-colors
                  disabled:opacity-50
                  flex items-center gap-2
                  ${pendingAction === 'suspend'
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-green-500 hover:bg-green-600'
                  }`}>
                {isProcessing ? (
                  <>
                    <Loader2 size={14}
                      className="animate-spin"/>
                    {t.processing}
                  </>
                ) : t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center
        justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/agencies"
            className="p-2 rounded-lg bg-gray-800
              text-gray-400 hover:bg-gray-700
              transition-colors"
            aria-label={t.back}>
            <BackArrow size={18}/>
          </Link>
          <div>
            <h1 className="text-xl font-bold
              text-white">
              {agency.name}
            </h1>
            <p className="text-gray-400 text-sm">
              {t.agencyDetails}
            </p>
          </div>
          <span className={`px-3 py-1
            rounded-full text-sm font-medium
            ${statusBadge.bg} ${statusBadge.text}`}>
            {statusBadge.label}
          </span>
        </div>

        <div className="flex gap-2"
          role="group"
          aria-label="Language selector">
          {VALID_LANGS.map(l => (
            <button
              key={l}
              type="button"
              onClick={() => setCurrentLang(l)}
              aria-pressed={currentLang === l}
              className={`px-3 py-1 rounded-lg
                text-xs font-medium
                transition-colors
                ${currentLang === l
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1
        sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <div className="rounded-xl p-4 border
          bg-gray-800/50 border-gray-700/50">
          <div className="flex items-center
            gap-2 mb-2">
            <Building2 size={16}
              className="text-gray-400"/>
            <span className="text-gray-400 text-sm">
              {t.plan}
            </span>
          </div>
          <span className={`px-3 py-1
            rounded-full text-sm font-medium
            ${planBadge.bg} ${planBadge.text}`}>
            {planBadge.label}
          </span>
        </div>

        <div className="rounded-xl p-4 border
          bg-gray-800/50 border-gray-700/50">
          <div className="flex items-center
            gap-2 mb-2">
            <Users size={16}
              className="text-gray-400"/>
            <span className="text-gray-400 text-sm">
              {t.clients}
            </span>
          </div>
          <span className="text-2xl font-bold
            text-white">
            {tenantsCount.toLocaleString()}
          </span>
        </div>

        <div className="rounded-xl p-4 border
          bg-gray-800/50 border-gray-700/50">
          <div className="flex items-center
            gap-2 mb-2">
            <MessageCircle size={16}
              className="text-gray-400"/>
            <span className="text-gray-400 text-sm">
              {t.messages}
            </span>
          </div>
          {isUnlimited ? (
            <span className="text-green-400
              font-medium">
              {t.unlimited}
            </span>
          ) : (
            <>
              <span className="text-white font-bold">
                {messagesUsed.toLocaleString()}
                {' / '}
                {messagesLimit.toLocaleString()}
              </span>
              <div className="mt-2 w-full
                bg-gray-700 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full
                    transition-all ${
                    messagesPercent > 80
                      ? 'bg-red-500'
                      : messagesPercent > 60
                        ? 'bg-orange-500'
                        : 'bg-green-500'
                  }`}
                  style={{
                    width: `${messagesPercent}%`
                  }}
                  role="progressbar"
                  aria-valuenow={messagesPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl p-4 border
          bg-gray-800/50 border-gray-700/50">
          <div className="flex items-center
            gap-2 mb-2">
            <Calendar size={16}
              className="text-gray-400"/>
            <span className="text-gray-400 text-sm">
              {t.joinDate}
            </span>
          </div>
          <span className="text-white font-medium
            text-sm">
            {formatDate(agency.created_at, t.locale)}
          </span>
        </div>
      </div>

      <div className="rounded-xl border
        bg-gray-800/50 border-gray-700/50
        p-4 space-y-4">

        <div className="flex items-center
          justify-between py-2 border-b
          border-gray-700/50">
          <div className="flex items-center
            gap-2 text-gray-400">
            <Phone size={16}/>
            <span className="text-sm">
              {t.whatsapp}
            </span>
          </div>
          <span className="text-white text-sm">
            {agency.whatsapp_number || t.notSet}
          </span>
        </div>

        <div className="flex items-center
          justify-between py-2 border-b
          border-gray-700/50">
          <div className="flex items-center
            gap-2 text-gray-400">
            <Globe size={16}/>
            <span className="text-sm">
              {t.domain}
            </span>
          </div>
          <span className="text-white text-sm">
            {agency.custom_domain || t.notSet}
          </span>
        </div>

        <div className="flex items-center
          justify-between py-2">
          <div className="flex items-center
            gap-2 text-gray-400">
            <Percent size={16}/>
            <span className="text-sm">
              {t.commission}
            </span>
          </div>
          <span className="text-yellow-400
            font-medium text-sm">
            {commissionRate}%
          </span>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        {isActive && (
          <button
            type="button"
            onClick={() => {
              setPendingAction('suspend')
              setShowModal(true)
              setError(null)
            }}
            className="px-6 py-2 rounded-lg
              bg-red-500/10 text-red-400
              border border-red-500/30
              hover:bg-red-500/20
              transition-colors
              flex items-center gap-2
              text-sm font-medium">
            <XCircle size={16}/>
            {t.suspend}
          </button>
        )}

        {isSuspended && (
          <button
            type="button"
            onClick={() => {
              setPendingAction('activate')
              setShowModal(true)
              setError(null)
            }}
            className="px-6 py-2 rounded-lg
              bg-green-500/10 text-green-400
              border border-green-500/30
              hover:bg-green-500/20
              transition-colors
              flex items-center gap-2
              text-sm font-medium">
            <CheckCircle size={16}/>
            {t.activate}
          </button>
        )}
      </div>

    </div>
  )
}
