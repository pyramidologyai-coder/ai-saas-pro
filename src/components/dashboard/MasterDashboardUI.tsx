'use client'

import React, { useCallback, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  DollarSign, Building2, Users,
  MessageCircle, TrendingUp, TrendingDown,
  Minus, AlertTriangle, Clock,
  Activity, Eye, PauseCircle, Loader2
} from 'lucide-react'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ✅ Types
interface RecentAgency {
  readonly id: string
  readonly name: string
  readonly plan_type:
    'starter' | 'growth' | 'pro' | 'vip'
  readonly status:
    'active' | 'inactive' | 'suspended' | 'pending' | 'unpaid'
  readonly created_at: string
  readonly tenants_count: number
}

interface MasterDashboardUIProps {
  readonly agenciesCount: number
  readonly tenantsCount: number
  readonly totalMessagesToday: number
  readonly expiringCount: number
  readonly highUsageCount: number
  readonly recentAgencies: RecentAgency[]
  readonly totalRevenue: number
  readonly agenciesGrowth: number
  readonly usageRate: number
}

interface KPICardProps {
  title: string
  value: string
  icon: React.ReactNode
  color: 'green' | 'blue' | 'purple' | 'cyan'
  subtitle: string
}

const COLOR_MAP = {
  green: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    icon: 'text-green-400',
    value: 'text-green-400'
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: 'text-blue-400',
    value: 'text-blue-400'
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    icon: 'text-purple-400',
    value: 'text-purple-400'
  },
  cyan: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    icon: 'text-cyan-400',
    value: 'text-cyan-400'
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

const STATUS_BADGES = {
  active: {
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    label: 'نشطة'
  },
  inactive: {
    bg: 'bg-gray-500/20',
    text: 'text-gray-400',
    label: 'غير نشطة'
  },
  suspended: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    label: 'موقوفة'
  },
  pending: {
    bg: 'bg-orange-500/20',
    text: 'text-orange-400',
    label: 'قيد الانتظار'
  },
  unpaid: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    label: 'بانتظار الدفع'
  }
} as const

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id)
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return '—'
  }
}

function formatNumber(num: number): string {
  if (!isFinite(num) || isNaN(num)) return '0'
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toLocaleString('ar-SA')
}

function formatRevenue(num: number): string {
  if (!isFinite(num) || isNaN(num)) return '$0'
  return '$' + num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

function renderGrowth(growth: number) {
  const safeGrowth = isNaN(growth)
    || !isFinite(growth) ? 0 : growth

  if (safeGrowth > 0) {
    return (
      <div className="flex items-center gap-2">
        <TrendingUp size={20}
          className="text-green-400"/>
        <span className="text-green-400
          text-2xl font-bold">
          +{safeGrowth}%
        </span>
      </div>
    )
  }
  if (safeGrowth < 0) {
    return (
      <div className="flex items-center gap-2">
        <TrendingDown size={20}
          className="text-red-400"/>
        <span className="text-red-400
          text-2xl font-bold">
          {safeGrowth}%
        </span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <Minus size={20}
        className="text-gray-400"/>
      <span className="text-gray-400
        text-2xl font-bold">
        0%
      </span>
    </div>
  )
}

function KPICard({
  title, value, icon, color, subtitle
}: KPICardProps) {
  const colors = COLOR_MAP[color]
  return (
    <div className={`
      rounded-xl p-4 border
      ${colors.bg} ${colors.border}
    `}>
      <div className="flex justify-between
        items-start mb-3">
        <span className="text-gray-400 text-sm">
          {title}
        </span>
        <div className={`
          p-2 rounded-lg
          ${colors.bg} ${colors.icon}
        `}>
          {icon}
        </div>
      </div>
      <div className={`
        text-2xl font-bold mb-1
        ${colors.value}
      `}>
        {value}
      </div>
      <div className="text-xs text-gray-500">
        {subtitle}
      </div>
    </div>
  )
}

export function MasterDashboardUI({
  agenciesCount,
  tenantsCount,
  totalMessagesToday,
  expiringCount,
  highUsageCount,
  recentAgencies,
  totalRevenue,
  agenciesGrowth,
  usageRate
}: MasterDashboardUIProps) {

  const safeUsageRate = Math.min(
    Math.max(0, isNaN(usageRate)
      ? 0 : usageRate), 100
  )

  const router = useRouter()

  const [suspending, setSuspending] =
    useState<string | null>(null)

  const [suspendError, setSuspendError] =
    useState<string | null>(null)

  const [confirmId, setConfirmId] =
    useState<string | null>(null)

  const handleSuspend = useCallback(
    async (agencyId: string) => {
      if (!UUID_REGEX.test(agencyId)) return
      if (suspending) return

      setSuspending(agencyId)
      setSuspendError(null)

      try {
        const res = await fetch(
          '/api/agencies/suspend',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ agencyId })
          }
        )

        if (res.ok) {
          router.refresh()
        } else {
          const data = await res.json()
            .catch(() => ({}))
          setSuspendError(
            data?.error === 'Agency is not active'
              ? 'الوكالة مش نشطة'
              : data?.error === 'Too many requests'
                ? 'محاولات كثيرة — انتظر دقيقة'
                : 'فشل تعطيل الوكالة'
          )
        }
      } catch {
        setSuspendError('حدث خطأ غير متوقع')
      } finally {
        setSuspending(null)
      }
    },
    [router, suspending]
  )

  return (
    <div dir="rtl" className="p-6 space-y-6">

      {confirmId && (
        <div className="fixed inset-0
          bg-black/60 flex items-center
          justify-center z-50
          backdrop-blur-sm">
          <div className="bg-gray-800
            rounded-xl p-6 max-w-sm w-full
            mx-4 border border-gray-700
            shadow-2xl">
            <h3 className="text-white
              font-semibold text-lg mb-2"
              dir="rtl">
              تأكيد التعطيل
            </h3>
            <p className="text-gray-400
              text-sm mb-4"
              dir="rtl">
              هل أنت متأكد من تعطيل هذه الوكالة؟
              لن تتمكن من الوصول للنظام.
            </p>
            {suspendError && (
              <p className="text-red-400
                text-sm mb-3 p-2
                bg-red-500/10 rounded-lg"
                dir="rtl">
                {suspendError}
              </p>
            )}
            <div className="flex gap-3
              justify-end">
              <button
                type="button"
                onClick={() => {
                  setConfirmId(null)
                  setSuspendError(null)
                }}
                disabled={!!suspending}
                className="px-4 py-2
                  rounded-lg bg-gray-700
                  text-gray-300
                  hover:bg-gray-600
                  text-sm transition-colors
                  disabled:opacity-50">
                إلغاء
              </button>
              <button
                type="button"
                disabled={!!suspending}
                onClick={async () => {
                  await handleSuspend(confirmId)
                  if (!suspendError) {
                    setConfirmId(null)
                  }
                }}
                className="px-4 py-2
                  rounded-lg bg-orange-500
                  text-white
                  hover:bg-orange-600
                  text-sm transition-colors
                  disabled:opacity-50
                  flex items-center gap-2">
                {suspending === confirmId ? (
                  <>
                    <Loader2 size={14}
                      className="animate-spin"/>
                    جاري التعطيل...
                  </>
                ) : (
                  'تعطيل'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* تنبيهات */}
      {expiringCount > 0 && (
        <div className="flex items-center
          justify-between gap-3 p-4
          bg-yellow-500/10 border
          border-yellow-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle
              className="text-yellow-400 shrink-0"
              size={20}/>
            <span className="text-yellow-300 text-sm">
              ⚠️ {expiringCount} وكالة
              اشتراكها ينتهي خلال 7 أيام
            </span>
          </div>
          <Link
            href="/dashboard/agencies"
            className="text-xs text-yellow-400
              hover:text-yellow-300
              underline shrink-0">
            عرض التفاصيل
          </Link>
        </div>
      )}

      {highUsageCount > 0 && (
        <div className="flex items-center
          justify-between gap-3 p-4
          bg-orange-500/10 border
          border-orange-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <Activity
              className="text-orange-400 shrink-0"
              size={20}/>
            <span className="text-orange-300 text-sm">
              🔴 {highUsageCount} عميل
              وصل 80% من رصيد رسائله
            </span>
          </div>
          <Link
            href="/dashboard/customers"
            className="text-xs text-orange-400
              hover:text-orange-300
              underline shrink-0">
            عرض التفاصيل
          </Link>
        </div>
      )}

      {/* KPI الرئيسية */}
      <div className="grid grid-cols-1
        md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="إجمالي الإيرادات"
          value={formatRevenue(totalRevenue)}
          icon={<DollarSign size={18}/>}
          color="green"
          subtitle="الوكالات + المباشرين"
        />
        <KPICard
          title="الوكالات النشطة"
          value={formatNumber(agenciesCount)}
          icon={<Building2 size={18}/>}
          color="blue"
          subtitle="وكالة مشتركة"
        />
        <KPICard
          title="إجمالي العملاء"
          value={formatNumber(tenantsCount)}
          icon={<Users size={18}/>}
          color="purple"
          subtitle="نشاط تجاري نشط"
        />
        <KPICard
          title="رسائل اليوم"
          value={formatNumber(totalMessagesToday)}
          icon={<MessageCircle size={18}/>}
          color="cyan"
          subtitle="رسالة اليوم"
        />
      </div>

      {/* KPI الثانوية */}
      <div className="grid grid-cols-1
        md:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* نمو الوكالات */}
        <div className="rounded-xl p-4 border
          bg-gray-800/50 border-gray-700/50
          space-y-2">
          <span className="text-gray-400 text-sm">
            نمو الوكالات
          </span>
          {renderGrowth(agenciesGrowth)}
          <span className="text-xs text-gray-500">
            مقارنة بالشهر الماضي
          </span>
        </div>

        {/* معدل الاستخدام */}
        <div className="rounded-xl p-4 border
          bg-gray-800/50 border-gray-700/50
          space-y-2">
          <span className="text-gray-400 text-sm">
            معدل الاستخدام
          </span>
          <span className={`text-2xl font-bold ${
            safeUsageRate > 80
              ? 'text-red-400'
              : safeUsageRate > 60
                ? 'text-orange-400'
                : 'text-green-400'
          }`}>
            {safeUsageRate}%
          </span>
          <div className="w-full bg-gray-700
            rounded-full h-2">
            <div
              className={`h-2 rounded-full
                transition-all duration-300 ${
                safeUsageRate > 80
                  ? 'bg-red-500'
                  : safeUsageRate > 60
                    ? 'bg-orange-500'
                    : 'bg-green-500'
              }`}
              style={{ width: `${safeUsageRate}%` }}
            />
          </div>
        </div>

        {/* وكالات تنتهي */}
        <div className={`rounded-xl p-4 border
          bg-gray-800/50 space-y-2 ${
          expiringCount > 0
            ? 'border-red-500/30'
            : 'border-gray-700/50'
        }`}>
          <div className="flex items-center gap-2">
            <Clock size={16} className={
              expiringCount > 0
                ? 'text-red-400'
                : 'text-gray-400'
            }/>
            <span className="text-gray-400 text-sm">
              وكالات تنتهي قريباً
            </span>
          </div>
          <span className={`text-2xl font-bold ${
            expiringCount > 0
              ? 'text-red-400'
              : 'text-gray-400'
          }`}>
            {expiringCount}
          </span>
          <span className="text-xs text-gray-500">
            خلال 7 أيام
          </span>
        </div>

        {/* عملاء 80% */}
        <div className={`rounded-xl p-4 border
          bg-gray-800/50 space-y-2 ${
          highUsageCount > 0
            ? 'border-orange-500/30'
            : 'border-gray-700/50'
        }`}>
          <div className="flex items-center gap-2">
            <Activity size={16} className={
              highUsageCount > 0
                ? 'text-orange-400'
                : 'text-gray-400'
            }/>
            <span className="text-gray-400 text-sm">
              استهلاك عالي
            </span>
          </div>
          <span className={`text-2xl font-bold ${
            highUsageCount > 0
              ? 'text-orange-400'
              : 'text-gray-400'
          }`}>
            {highUsageCount}
          </span>
          <span className="text-xs text-gray-500">
            وصلوا 80% من الرصيد
          </span>
        </div>
      </div>

      {/* جدول الوكالات */}
      <div className="rounded-xl border
        bg-gray-800/50 border-gray-700/50 p-4">
        <div className="flex justify-between
          items-center mb-4">
          <h3 className="text-lg font-semibold
            text-white">
            أحدث الوكالات
          </h3>
          <Link
            href="/super-admin/agencies"
            className="text-sm text-blue-400
              hover:text-blue-300
              transition-colors">
            عرض الكل ←
          </Link>
        </div>

        {recentAgencies.length === 0 ? (
          <div className="flex flex-col
            items-center justify-center
            py-12 gap-3">
            <Building2 size={48}
              className="text-gray-600"/>
            <p className="text-gray-500 text-sm">
              لا توجد وكالات بعد
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400
                  border-b border-gray-700">
                  <th className="text-right
                    py-3 px-2 font-medium">
                    اسم الوكالة
                  </th>
                  <th className="text-right
                    py-3 px-2 font-medium">
                    الباقة
                  </th>
                  <th className="text-center
                    py-3 px-2 font-medium">
                    العملاء
                  </th>
                  <th className="text-right
                    py-3 px-2 font-medium">
                    الحالة
                  </th>
                  <th className="text-right
                    py-3 px-2 font-medium">
                    تاريخ الانضمام
                  </th>
                  <th className="text-center
                    py-3 px-2 font-medium">
                    إجراءات
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentAgencies.map(agency => {
                  if (!isValidUUID(agency.id)) {
                    return null
                  }

                  const planBadge =
                    PLAN_BADGES[agency.plan_type]
                      ?? PLAN_BADGES.starter
                  const statusBadge =
                    STATUS_BADGES[agency.status]
                      ?? STATUS_BADGES.inactive

                  const firstChar =
                    agency.name.trim()
                      .charAt(0)
                      .toUpperCase() || '?'

                  return (
                    <tr key={agency.id}
                      className="border-b
                        border-gray-800
                        hover:bg-gray-700/30
                        transition-colors">

                      <td className="py-3 px-2">
                        <div className="flex
                          items-center gap-2">
                          <div className="w-8 h-8
                            rounded-full
                            bg-blue-500/20
                            flex items-center
                            justify-center
                            text-blue-400
                            font-medium shrink-0"
                            aria-hidden="true">
                            {firstChar}
                          </div>
                          <span className="text-white
                            truncate max-w-[120px]">
                            {agency.name}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-2">
                        <span className={`
                          px-2 py-1 rounded-full
                          text-xs font-medium
                          ${planBadge.bg}
                          ${planBadge.text}
                        `}>
                          {planBadge.label}
                        </span>
                      </td>

                      <td className="py-3 px-2
                        text-center">
                        <span className="font-semibold
                          text-white">
                          {formatNumber(
                            agency.tenants_count
                          )}
                        </span>
                      </td>

                      <td className="py-3 px-2">
                        <span className={`
                          px-2 py-1 rounded-full
                          text-xs font-medium
                          ${statusBadge.bg}
                          ${statusBadge.text}
                        `}>
                          {statusBadge.label}
                        </span>
                      </td>

                      <td className="py-3 px-2
                        text-gray-400">
                        {formatDate(
                          agency.created_at
                        )}
                      </td>

                      <td className="py-3 px-2">
                        <div className="flex
                          items-center
                          justify-center gap-2">

                          <Link
                            href={
                              `/super-admin/agencies/${agency.id}`
                            }
                            aria-label={
                              `عرض تفاصيل ${agency.name}`
                            }
                            className="p-1.5
                              rounded-lg
                              bg-blue-500/10
                              text-blue-400
                              hover:bg-blue-500/20
                              transition-colors">
                            <Eye size={14}/>
                          </Link>

                          {agency.status ===
                            'active' && (
                            <button
                              type="button"
                              disabled={!!suspending}
                              onClick={() =>
                                setConfirmId(
                                  agency.id
                                )
                              }
                              aria-label={
                                `تعطيل ${agency.name}`
                              }
                              className="p-1.5
                                rounded-lg
                                bg-orange-500/10
                                text-orange-400
                                hover:bg-orange-500/20
                                transition-colors
                                disabled:opacity-50">
                              <PauseCircle size={14}/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
