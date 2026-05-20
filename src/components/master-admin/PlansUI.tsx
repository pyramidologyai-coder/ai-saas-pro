'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Check, X, Edit2, Save, Loader2, Key, Activity, DollarSign, Users, Shield } from 'lucide-react'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id)
}

interface PlanFeature {
  id: string
  plan_id: string
  feature_key: string
  feature_value: any
}

interface Plan {
  id: string
  name: string
  slug: string
  price_monthly: number
  price_yearly: number
  is_active: boolean
  agencies_count: number
  revenue: number
  features?: PlanFeature[]
}

interface PlansUIProps {
  initialPlans: Plan[]
  initialLang: string
}

export function PlansUI({ initialPlans, initialLang }: PlansUIProps) {
  const router = useRouter()
  const isRTL = initialLang === 'ar'

  const [plans, setPlans] = useState<Plan[]>(initialPlans)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Edit State
  const [editPriceMonthly, setEditPriceMonthly] = useState<number>(0)
  const [editPriceYearly, setEditPriceYearly] = useState<number>(0)
  
  // Loading States
  const [loadingAction, setLoadingAction] = useState<string | null>(null) // ID of plan being toggled
  const [savingAction, setSavingAction] = useState<string | null>(null) // ID of plan being saved

  const handleToggleStatus = async (planId: string, currentStatus: boolean) => {
    if (!isValidUUID(planId)) return
    
    setLoadingAction(planId)
    try {
      const { error } = await supabase.rpc('toggle_plan_status', {
        p_plan_id: planId,
        p_is_active: !currentStatus
      })

      if (error) {
        alert('حدث خطأ أثناء تغيير حالة الباقة')
        console.error(error)
      } else {
        setPlans(prev => prev.map(p => 
          p.id === planId ? { ...p, is_active: !currentStatus } : p
        ))
        router.refresh()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingAction(null)
    }
  }

  const startEditing = (plan: Plan) => {
    setEditingId(plan.id)
    setEditPriceMonthly(plan.price_monthly)
    setEditPriceYearly(plan.price_yearly)
  }

  const savePricing = async (planId: string) => {
    if (!isValidUUID(planId)) return
    
    setSavingAction(planId)
    try {
      const { error } = await supabase.rpc('update_plan_pricing', {
        p_plan_id: planId,
        p_price_monthly: editPriceMonthly,
        p_price_yearly: editPriceYearly
      })

      if (error) {
        alert('حدث خطأ أثناء تحديث الأسعار')
        console.error(error)
      } else {
        setPlans(prev => prev.map(p => 
          p.id === planId ? { 
            ...p, 
            price_monthly: editPriceMonthly, 
            price_yearly: editPriceYearly 
          } : p
        ))
        setEditingId(null)
        router.refresh()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSavingAction(null)
    }
  }

  const renderFeatures = (features: PlanFeature[], slug: string) => {
    if (!features || features.length === 0) return (
      <div className="text-gray-500 text-sm">لا توجد ميزات مخصصة (Default)</div>
    )
    return (
      <ul className="space-y-2 mt-4 text-sm text-gray-300">
        {features.map(f => (
          <li key={f.id} className="flex items-center gap-2">
            <Check size={14} className="text-green-400" />
            <span>{f.feature_key}: {String(f.feature_value)}</span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Shield className="text-blue-500" />
            إدارة باقات المنصة (Master Plans)
          </h1>
          <p className="text-gray-400 mt-2">
            التحكم في تفعيل وتسعير باقات الوكالات (Starter, Growth, Pro, VIP)
          </p>
        </div>
      </div>

      {/* Grid of Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const isEditing = editingId === plan.id
          const isVIP = plan.slug === 'vip'
          const isActive = plan.is_active

          return (
            <div 
              key={plan.id}
              className={`
                relative flex flex-col rounded-2xl border p-6 overflow-hidden
                ${isActive ? 'bg-gray-800/80 border-gray-700' : 'bg-gray-900/50 border-gray-800 opacity-80'}
                ${isVIP && isActive ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.15)]' : ''}
                transition-all duration-300
              `}
            >
              {/* Header: Name and Status Toggle */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className={`text-xl font-bold ${isVIP ? 'text-yellow-400' : 'text-white'}`}>
                    {plan.name || plan.slug.toUpperCase()}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-xs text-gray-400">
                      {isActive ? 'مُفعلة' : 'مُعطلة'}
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={() => handleToggleStatus(plan.id, plan.is_active)}
                  disabled={loadingAction === plan.id}
                  className={`
                    p-2 rounded-lg text-sm transition-colors border
                    ${isActive 
                      ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' 
                      : 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'}
                  `}
                  title={isActive ? 'تعطيل الباقة' : 'تفعيل الباقة'}
                >
                  {loadingAction === plan.id ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : isActive ? (
                    <X size={18} />
                  ) : (
                    <Check size={18} />
                  )}
                </button>
              </div>

              {/* Pricing Section */}
              <div className="mb-6 p-4 rounded-xl bg-gray-900/50 border border-gray-800">
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">السعر الشهري ($)</label>
                      <div className="relative">
                        <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                          type="number"
                          value={editPriceMonthly}
                          onChange={(e) => setEditPriceMonthly(Number(e.target.value))}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-4 py-2 text-white outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">السعر السنوي ($)</label>
                      <div className="relative">
                        <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                          type="number"
                          value={editPriceYearly}
                          onChange={(e) => setEditPriceYearly(Number(e.target.value))}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-4 py-2 text-white outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button 
                        onClick={() => savePricing(plan.id)}
                        disabled={savingAction === plan.id}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 flex justify-center items-center gap-2 text-sm font-medium"
                      >
                        {savingAction === plan.id ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        حفظ
                      </button>
                      <button 
                        onClick={() => setEditingId(null)}
                        className="px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg py-2 text-sm"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center group">
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-white">${plan.price_monthly}</span>
                        <span className="text-gray-500 text-sm">/شهر</span>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        ${plan.price_yearly} /سنة
                      </div>
                    </div>
                    <button 
                      onClick={() => startEditing(plan)}
                      className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity border border-gray-700"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 flex items-center gap-1"><Users size={12}/> وكالات</span>
                  <span className="font-semibold text-white">{plan.agencies_count || 0}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 flex items-center gap-1"><Activity size={12}/> إيرادات</span>
                  <span className="font-semibold text-green-400">${plan.revenue || 0}</span>
                </div>
              </div>

              <div className="h-px w-full bg-gray-800 my-4" />

              {/* VIP Notice */}
              {isVIP && (
                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-start gap-3">
                  <Key className="text-yellow-400 shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-yellow-300/90 leading-relaxed">
                    ميزة حصرية: أصحاب هذه الباقة يمكنهم إضافة (API Keys) الخاصة بهم (مثل Meta Token و Gemini) للعمل بشكل مستقل تماماً.
                  </p>
                </div>
              )}

              {/* Feature Flags */}
              <div className="flex-1">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  صلاحيات الباقة (Feature Flags)
                </h4>
                {renderFeatures(plan.features || [], plan.slug)}
              </div>

            </div>
          )
        })}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <Shield size={48} className="mx-auto mb-4 opacity-50" />
          <p>جاري تحميل الباقات أو لا توجد باقات لعرضها</p>
        </div>
      )}

    </div>
  )
}
