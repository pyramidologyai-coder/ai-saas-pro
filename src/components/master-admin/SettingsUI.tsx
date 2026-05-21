'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { 
  Check, X, Edit2, Save, Loader2, Key, Activity, 
  DollarSign, Users, Shield, Settings, Lock, ShieldAlert,
  Calendar, Trash2, Plus, Info, Globe, AlertTriangle
} from 'lucide-react'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id)
}

type Lang = 'ar' | 'en' | 'fr'

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
  commission_rate: number
  messages_limit: number
  voice_minutes_limit: number
  reminder_enabled: boolean
  voice_reminder_enabled: boolean
  reminder_credits: number
  features?: PlanFeature[]
}

interface SettingsUIProps {
  initialPlatformSettings: any
  initialPlans: Plan[]
  failedLoginsCount: number
  user: any
  initialLang: string
}

const DICTIONARY = {
  ar: {
    title: 'إعدادات المنصة والتحكم',
    subtitle: 'إدارة إعدادات المنصة الأساسية، تسعير وباقات الاشتراك، وضوابط الأمان الفنية.',
    tabPlatform: 'إعدادات المنصة',
    tabPlans: 'إدارة الباقات',
    tabSecurity: 'الأمان والحماية',
    
    // Tab 1: Platform Settings
    platformName: 'اسم المنصة',
    currency: 'العملة',
    defaultCommission: 'نسبة عمولة المنصة الافتراضية (%)',
    trialPeriod: 'فترة التجربة الافتراضية (أيام)',
    savePlatformSettings: 'حفظ إعدادات المنصة',
    baseFee: 'رسوم الوكالة الأساسية ($)',
    platformSectionTitle: 'إدارة هوية وقوانين المنصة',
    platformSectionDesc: 'التحكم في المعايير المالية والتجريبية التي تنطبق على جميع الوكالات المسجلة.',
    
    // Tab 2: Plans Management
    addPlan: 'إضافة باقة جديدة',
    deletePlan: 'حذف الباقة',
    editPricing: 'تعديل الأسعار',
    monthlyPrice: 'السعر الشهري ($)',
    yearlyPrice: 'السعر السنوي ($)',
    messagesLimit: 'حد الرسائل',
    voiceMinutesLimit: 'حد دقائق الصوت',
    commissionRate: 'نسبة عمولة الباقة (%)',
    reminderEnabled: 'تفعيل التذكير التلقائي',
    voiceReminderEnabled: 'تفعيل التذكير الصوتي',
    reminderCredits: 'رصيد التذكيرات',
    isActive: 'مُفعلة',
    isInactive: 'مُعطلة',
    confirmDelete: 'هل أنت متأكد من حذف هذه الباقة؟ لا يمكن التراجع عن هذا الإجراء.',
    plansSectionTitle: 'باقات الاشتراك والحدود المتاحة',
    plansSectionDesc: 'إدارة تسعير الباقات الأربع الأساسية وتحديد سقوف الاستخدام ونسب العمولات المخصصة.',
    
    // Add Plan Form
    planName: 'اسم الباقة',
    planSlug: 'رمز الباقة (Slug)',
    pMessagesLimit: 'حد الرسائل (أدخل -1 للرسائل غير المحدودة)',
    pVoiceMinutesLimit: 'حد دقائق الصوت (أدخل -1 للدقائق غير المحدودة)',
    pReminderCredits: 'رصيد تذكير مجاني',
    submit: 'إضافة الباقة الآن',
    cancel: 'إلغاء',
    
    // Tab 3: Security
    masterAdminId: 'معرف مدير النظام (Master Admin ID)',
    lastSignIn: 'تاريخ آخر تسجيل دخول',
    failedLogins: 'عدد محاولات الدخول الفاشلة',
    failedLoginsDesc: 'عدد محاولات تسجيل الدخول الفاشلة المسجلة في سجلات الأمان.',
    securityInfo: 'معلومات الأمان والحماية الحية',
    securitySectionTitle: 'ضوابط التحقق وهيبة النظام',
    securitySectionDesc: 'نظرة عامة على حالة الجلسة النشطة ومحاولات الاختراق أو الفشل من سجل المراجعة.',
    
    // Messages
    successSave: 'تم حفظ الإعدادات بنجاح ✓',
    errorSave: 'حدث خطأ أثناء حفظ الإعدادات',
    successAddPlan: 'تم إضافة الباقة بنجاح ✓',
    errorAddPlan: 'حدث خطأ أثناء إضافة الباقة',
    successDeletePlan: 'تم حذف الباقة بنجاح ✓',
    errorDeletePlan: 'حدث خطأ أثناء حذف الباقة',
    noPlans: 'لا توجد باقات معروضة حالياً.',
    loading: 'جاري التحميل...',
    saveStatusSaving: 'جاري الحفظ...',
    dbAlterWarning: 'ملاحظة: لحفظ اسم المنصة وفترة التجربة بشكل دائم، يرجى التأكد من تشغيل أمر التحديث لقاعدة البيانات (ALTER TABLE) في لوحة Supabase.',
    unlimited: 'غير محدود',
    minutes: 'دقيقة'
  },
  en: {
    title: 'Platform Settings & Control',
    subtitle: 'Manage core platform settings, pricing models, subscription plans, and system security controls.',
    tabPlatform: 'Platform Settings',
    tabPlans: 'Plans Management',
    tabSecurity: 'Security & Access',
    
    // Tab 1: Platform Settings
    platformName: 'Platform Name',
    currency: 'Currency',
    defaultCommission: 'Default Commission Rate (%)',
    trialPeriod: 'Default Trial Period (Days)',
    savePlatformSettings: 'Save Settings',
    baseFee: 'Agency Base Fee ($)',
    platformSectionTitle: 'Platform Identity & Financial Rules',
    platformSectionDesc: 'Control commercial policies, trial limits, and pricing baselines across all tenants.',
    
    // Tab 2: Plans Management
    addPlan: 'Add New Plan',
    deletePlan: 'Delete Plan',
    editPricing: 'Edit Pricing',
    monthlyPrice: 'Monthly Price ($)',
    yearlyPrice: 'Yearly Price ($)',
    messagesLimit: 'Messages Limit',
    voiceMinutesLimit: 'Voice Minutes Limit',
    commissionRate: 'Plan Commission Rate (%)',
    reminderEnabled: 'Auto Reminder',
    voiceReminderEnabled: 'Voice Reminder',
    reminderCredits: 'Reminder Credits',
    isActive: 'Active',
    isInactive: 'Inactive',
    confirmDelete: 'Are you sure you want to delete this plan? This action cannot be undone.',
    plansSectionTitle: 'Subscription Plans & Consumption Thresholds',
    plansSectionDesc: 'Manage prices for default plans (Starter, Growth, Pro, VIP), usage rates, and custom commissions.',
    
    // Add Plan Form
    planName: 'Plan Name',
    planSlug: 'Plan Slug',
    pMessagesLimit: 'Messages Limit (Enter -1 for unlimited)',
    pVoiceMinutesLimit: 'Voice Minutes Limit (Enter -1 for unlimited)',
    pReminderCredits: 'Free Reminder Credits',
    submit: 'Add Plan Now',
    cancel: 'Cancel',
    
    // Tab 3: Security
    masterAdminId: 'Master Admin ID',
    lastSignIn: 'Last Sign-in Date',
    failedLogins: 'Failed Login Attempts',
    failedLoginsDesc: 'Number of failed sign-in operations tracked in security logs.',
    securityInfo: 'Live Security Profile',
    securitySectionTitle: 'Authentication & System Shield',
    securitySectionDesc: 'View session activity details and failed login logs to prevent credential stuffing.',
    
    // Messages
    successSave: 'Settings saved successfully ✓',
    errorSave: 'An error occurred while saving settings',
    successAddPlan: 'Plan added successfully ✓',
    errorAddPlan: 'An error occurred while adding the plan',
    successDeletePlan: 'Plan deleted successfully ✓',
    errorDeletePlan: 'An error occurred while deleting the plan',
    noPlans: 'No plans found.',
    loading: 'Loading...',
    saveStatusSaving: 'Saving...',
    dbAlterWarning: 'Note: To permanently store Platform Name and Trial Period, make sure you applied the ALTER TABLE migrations in Supabase SQL editor.',
    unlimited: 'Unlimited',
    minutes: 'min'
  },
  fr: {
    title: 'Configuration de la Plateforme',
    subtitle: 'Gerez les parametres globaux, la tarification, les abonnements et les audits de securite.',
    tabPlatform: 'Parametres',
    tabPlans: 'Gestion des Offres',
    tabSecurity: 'Securite & Acces',
    
    // Tab 1: Platform Settings
    platformName: 'Nom de la plateforme',
    currency: 'Devise',
    defaultCommission: 'Taux de commission par defaut (%)',
    trialPeriod: 'Periode d\'essai (Jours)',
    savePlatformSettings: 'Enregistrer les modifications',
    baseFee: 'Frais de base d\'agence ($)',
    platformSectionTitle: 'Identité de la Plateforme & Règles Financières',
    platformSectionDesc: 'Contrôlez les politiques commerciales, les limites d\'essai et les prix de base pour toutes les agences.',
    
    // Tab 2: Plans Management
    addPlan: 'Ajouter un forfait',
    deletePlan: 'Supprimer',
    editPricing: 'Modifier le prix',
    monthlyPrice: 'Prix mensuel ($)',
    yearlyPrice: 'Prix annuel ($)',
    messagesLimit: 'Limite de messages',
    voiceMinutesLimit: 'Limite de minutes vocales',
    commissionRate: 'Commission du forfait (%)',
    reminderEnabled: 'Rappels automatiques',
    voiceReminderEnabled: 'Rappels vocaux',
    reminderCredits: 'Credits de rappel',
    isActive: 'Actif',
    isInactive: 'Inactif',
    confirmDelete: 'Etes-vous sur de vouloir supprimer ce forfait? Cette action est irreversible.',
    plansSectionTitle: 'Forfaits d\'abonnement & Seuils de Consommation',
    plansSectionDesc: 'Gérez la tarification des offres clés (Starter, Growth, Pro, VIP), la consommation et les commissions.',
    
    // Add Plan Form
    planName: 'Nom du forfait',
    planSlug: 'Slug du forfait',
    pMessagesLimit: 'Limite de messages (Saisissez -1 pour illimite)',
    pVoiceMinutesLimit: 'Limite de minutes vocales (Saisissez -1 pour illimite)',
    pReminderCredits: 'Credits de rappel gratuits',
    submit: 'Enregistrer',
    cancel: 'Annuler',
    
    // Tab 3: Security
    masterAdminId: 'ID Administrateur Master',
    lastSignIn: 'Derniere connexion',
    failedLogins: 'Tentatives de connexion echouees',
    failedLoginsDesc: 'Nombre d\'echecs de connexion enregistres dans les journaux de securite.',
    securityInfo: 'Profil de securite en direct',
    securitySectionTitle: 'Contrôles d\'Accès & Sécurité Active',
    securitySectionDesc: 'Consultez les détails des connexions actives et suivez les tentatives de connexion échouées.',
    
    // Messages
    successSave: 'Parametres enregistres avec succes ✓',
    errorSave: 'Une erreur est survenue lors de l\'enregistrement',
    successAddPlan: 'Forfait ajoute avec succes ✓',
    errorAddPlan: 'Une erreur est survenue lors de l\'ajout',
    successDeletePlan: 'Forfait supprime avec succes ✓',
    errorDeletePlan: 'Une erreur est survenue lors de la suppression',
    noPlans: 'Aucun forfait trouve.',
    loading: 'Chargement...',
    saveStatusSaving: 'Enregistrement...',
    dbAlterWarning: 'Note: Pour enregistrer le nom et la période d\'essai, assurez-vous d\'exécuter l\'instruction ALTER TABLE dans l\'éditeur Supabase.',
    unlimited: 'Illimité',
    minutes: 'min'
  }
} as const

export function SettingsUI({
  initialPlatformSettings,
  initialPlans,
  failedLoginsCount,
  user,
  initialLang
}: SettingsUIProps) {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [lang, setLang] = useState<Lang>(initialLang as Lang)
  const isRTL = lang === 'ar'
  const d = DICTIONARY[lang]

  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'platform' | 'plans' | 'security'>('platform')

  // Platform Settings State
  const [platformName, setPlatformName] = useState(
    initialPlatformSettings?.platform_name || 'AI Clinic & Restaurant SaaS'
  )
  const [currency, setCurrency] = useState(
    initialPlatformSettings?.currency || 'USD'
  )
  const [agencyPercentage, setAgencyPercentage] = useState<number>(
    initialPlatformSettings?.agency_percentage ?? 20
  )
  const [agencyBaseFee, setAgencyBaseFee] = useState<number>(
    initialPlatformSettings?.agency_base_fee ?? 100
  )
  const [trialPeriodDays, setTrialPeriodDays] = useState<number>(
    initialPlatformSettings?.trial_period_days ?? 7
  )
  const [savingPlatform, setSavingPlatform] = useState(false)
  const [platformMessage, setPlatformMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Plans State
  const [plans, setPlans] = useState<Plan[]>(initialPlans)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Editing Plan Pricing State
  const [editPriceMonthly, setEditPriceMonthly] = useState<number>(0)
  const [editPriceYearly, setEditPriceYearly] = useState<number>(0)
  
  // Plan Action Loaders
  const [togglingPlanId, setTogglingPlanId] = useState<string | null>(null)
  const [savingPricingId, setSavingPricingId] = useState<string | null>(null)
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null)

  // Add Plan Form State
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPlanName, setNewPlanName] = useState('')
  const [newPlanSlug, setNewPlanSlug] = useState('')
  const [newPriceMonthly, setNewPriceMonthly] = useState<number>(0)
  const [newPriceYearly, setNewPriceYearly] = useState<number>(0)
  const [newMessagesLimit, setNewMessagesLimit] = useState<number>(1000)
  const [newVoiceLimit, setNewVoiceLimit] = useState<number>(60)
  const [newCommissionRate, setNewCommissionRate] = useState<number>(0)
  const [newReminderEnabled, setNewReminderEnabled] = useState(false)
  const [newVoiceReminderEnabled, setNewVoiceReminderEnabled] = useState(false)
  const [newReminderCredits, setNewReminderCredits] = useState<number>(0)
  const [addingPlan, setAddingPlan] = useState(false)

  // ----------------------------------------------------
  // Actions
  // ----------------------------------------------------

  const handleSavePlatformSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPlatform(true)
    setPlatformMessage(null)

    try {
      const payload: any = {
        agency_base_fee: agencyBaseFee,
        agency_percentage: agencyPercentage,
        updated_at: new Date().toISOString()
      }

      // Check if schema has columns for platform_name and trial_period_days
      // We safely put them in the payload; if the db throws error we'll catch it and retry with a fallback safe payload
      const fullPayload = {
        ...payload,
        platform_name: platformName,
        currency: 'USD', // USD ($) currency only
        trial_period_days: trialPeriodDays
      }

      let settingsId = initialPlatformSettings?.id
      let result;

      if (settingsId && isValidUUID(settingsId)) {
        result = await supabase
          .from('platform_settings')
          .update(fullPayload)
          .eq('id', settingsId)
      } else {
        result = await supabase
          .from('platform_settings')
          .insert([fullPayload])
      }

      if (result.error) {
        console.warn("Full payload insert/update failed, retrying with fallback safe payload (excluding custom columns)...", result.error)
        
        // Fallback retry using only base columns
        let fallbackResult;
        if (settingsId && isValidUUID(settingsId)) {
          fallbackResult = await supabase
            .from('platform_settings')
            .update(payload)
            .eq('id', settingsId)
        } else {
          fallbackResult = await supabase
            .from('platform_settings')
            .insert([payload])
        }

        if (fallbackResult.error) {
          throw new Error(fallbackResult.error.message)
        } else {
          setPlatformMessage({
            text: `${d.successSave} (${d.dbAlterWarning})`,
            type: 'success'
          })
        }
      } else {
        setPlatformMessage({ text: d.successSave, type: 'success' })
      }

      router.refresh()
    } catch (err: any) {
      console.error(err)
      setPlatformMessage({ text: d.errorSave + ': ' + err.message, type: 'error' })
    } finally {
      setSavingPlatform(false)
    }
  }

  const handleToggleStatus = async (planId: string, currentStatus: boolean) => {
    if (!isValidUUID(planId)) return
    
    setTogglingPlanId(planId)
    try {
      const { error } = await supabase.rpc('toggle_plan_status', {
        p_plan_id: planId,
        p_is_active: !currentStatus
      })

      if (error) {
        alert(d.errorSave)
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
      setTogglingPlanId(null)
    }
  }

  const startEditing = (plan: Plan) => {
    if (!isValidUUID(plan.id)) return
    setEditingId(plan.id)
    setEditPriceMonthly(plan.price_monthly)
    setEditPriceYearly(plan.price_yearly)
  }

  const savePricing = async (planId: string) => {
    if (!isValidUUID(planId)) return
    
    setSavingPricingId(planId)
    try {
      const { error } = await supabase.rpc('update_plan_pricing', {
        p_plan_id: planId,
        p_price_monthly: editPriceMonthly,
        p_price_yearly: editPriceYearly
      })

      if (error) {
        alert(d.errorSave)
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
      setSavingPricingId(null)
    }
  }

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingPlan(true)

    try {
      const { data, error } = await supabase.rpc('add_plan', {
        p_name: newPlanName,
        p_slug: newPlanSlug.toLowerCase().trim(),
        p_price_monthly: newPriceMonthly,
        p_price_yearly: newPriceYearly,
        p_messages_limit: newMessagesLimit,
        p_voice_minutes_limit: newVoiceLimit,
        p_commission_rate: newCommissionRate,
        p_reminder_enabled: newReminderEnabled,
        p_voice_reminder_enabled: newVoiceReminderEnabled,
        p_reminder_credits: newReminderCredits
      })

      if (error || (data && !data.success)) {
        const errorMsg = error ? error.message : (data ? data.error : d.errorAddPlan)
        alert(d.errorAddPlan + ': ' + errorMsg)
      } else {
        alert(d.successAddPlan)
        setShowAddForm(false)
        
        // Reset Form
        setNewPlanName('')
        setNewPlanSlug('')
        setNewPriceMonthly(0)
        setNewPriceYearly(0)
        setNewMessagesLimit(1000)
        setNewVoiceLimit(60)
        setNewCommissionRate(0)
        setNewReminderEnabled(false)
        setNewVoiceReminderEnabled(false)
        setNewReminderCredits(0)

        // Reload plans
        const { data: updatedPlans } = await supabase.rpc('get_plans_with_stats')
        if (updatedPlans) setPlans(updatedPlans)
        router.refresh()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setAddingPlan(false)
    }
  }

  const handleDeletePlan = async (planId: string) => {
    if (!isValidUUID(planId)) return
    if (!confirm(d.confirmDelete)) return

    setDeletingPlanId(planId)
    try {
      const { data, error } = await supabase.rpc('delete_plan', {
        p_plan_id: planId
      })

      if (error || (data && !data.success)) {
        const errorMsg = error ? error.message : (data ? data.error : d.errorDeletePlan)
        alert(d.errorDeletePlan + ': ' + errorMsg)
      } else {
        alert(d.successDeletePlan)
        setPlans(prev => prev.filter(p => p.id !== planId))
        router.refresh()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingPlanId(null)
    }
  }

  // Helper for rendering badges
  const getActionBadgeColor = (isActive: boolean) => {
    return isActive 
      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
      : 'bg-red-500/10 text-red-400 border border-red-500/15'
  }

  // Format timestamp beautifully with Arabic/English locale support
  const formatTimestamp = (dateStr: string) => {
    try {
      if (!dateStr) return '—'
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return '—'
      return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-8 max-w-7xl mx-auto text-gray-100 min-h-screen">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Shield className="text-purple-500" size={32} />
            {d.title}
          </h1>
          <p className="text-gray-400 mt-2 text-sm max-w-2xl leading-relaxed">
            {d.subtitle}
          </p>
        </div>

        {/* Language selector */}
        <div className="flex items-center gap-2 bg-gray-800/80 p-1 rounded-xl border border-gray-700/50 self-end md:self-auto">
          <button
            onClick={() => startTransition(() => setLang('ar'))}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              lang === 'ar' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            العربية
          </button>
          <button
            onClick={() => startTransition(() => setLang('en'))}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              lang === 'en' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            English
          </button>
          <button
            onClick={() => startTransition(() => setLang('fr'))}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              lang === 'fr' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            Français
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-850 gap-2">
        <button
          onClick={() => setActiveTab('platform')}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'platform' 
              ? 'border-purple-500 text-purple-400' 
              : 'border-transparent text-gray-400 hover:text-white hover:border-gray-700'
          }`}
        >
          <Settings size={18} />
          {d.tabPlatform}
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'plans' 
              ? 'border-purple-500 text-purple-400' 
              : 'border-transparent text-gray-400 hover:text-white hover:border-gray-700'
          }`}
        >
          <Activity size={18} />
          {d.tabPlans}
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'security' 
              ? 'border-purple-500 text-purple-400' 
              : 'border-transparent text-gray-400 hover:text-white hover:border-gray-700'
          }`}
        >
          <Lock size={18} />
          {d.tabSecurity}
        </button>
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        
        {/* ======================================================== */}
        {/* TAB 1: Platform Settings */}
        {/* ======================================================== */}
        {activeTab === 'platform' && (
          <div className="bg-gray-850/40 border border-gray-800/80 rounded-2xl p-6 md:p-8 space-y-6 max-w-4xl">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="text-purple-400" size={22} />
                {d.platformSectionTitle}
              </h2>
              <p className="text-gray-400 text-sm mt-1">{d.platformSectionDesc}</p>
            </div>

            {platformMessage && (
              <div 
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  platformMessage.type === 'success' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}
              >
                <Info size={18} className="shrink-0 mt-0.5" />
                <span className="text-sm font-medium leading-relaxed">{platformMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSavePlatformSettings} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Platform Name */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-300 block">{d.platformName}</label>
                  <input
                    type="text"
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    required
                    className="w-full bg-gray-900 border border-gray-850 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm"
                  />
                </div>

                {/* Currency - Read-only $ only */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-300 block flex items-center gap-1.5">
                    {d.currency}
                    <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/15">
                      Fixed
                    </span>
                  </label>
                  <div className="relative">
                    <DollarSign size={16} className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-gray-400`} />
                    <input
                      type="text"
                      value={`${currency} ($)`}
                      disabled
                      className="w-full bg-gray-950/80 border border-gray-850 rounded-xl px-4 py-3 text-gray-400 outline-none cursor-not-allowed text-sm font-bold disabled:opacity-80 relative"
                      style={{ paddingLeft: isRTL ? '1rem' : '2.5rem', paddingRight: isRTL ? '2.5rem' : '1rem' }}
                    />
                  </div>
                </div>

                {/* Default Commission Rate */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-300 block">{d.defaultCommission}</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={agencyPercentage}
                    onChange={(e) => setAgencyPercentage(Number(e.target.value))}
                    required
                    className="w-full bg-gray-900 border border-gray-850 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm font-mono"
                  />
                </div>

                {/* Trial Period in Days */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-300 block">{d.trialPeriod}</label>
                  <input
                    type="number"
                    min="0"
                    value={trialPeriodDays}
                    onChange={(e) => setTrialPeriodDays(Number(e.target.value))}
                    required
                    className="w-full bg-gray-900 border border-gray-850 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm font-mono"
                  />
                </div>

                {/* Agency Base Fee */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-300 block">{d.baseFee}</label>
                  <div className="relative">
                    <DollarSign size={16} className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-gray-400`} />
                    <input
                      type="number"
                      min="0"
                      value={agencyBaseFee}
                      onChange={(e) => setAgencyBaseFee(Number(e.target.value))}
                      required
                      className="w-full bg-gray-900 border border-gray-850 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm font-mono"
                      style={{ paddingLeft: isRTL ? '1rem' : '2.5rem', paddingRight: isRTL ? '2.5rem' : '1rem' }}
                    />
                  </div>
                </div>

              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={savingPlatform}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800/80 text-white rounded-xl px-6 py-3 font-semibold flex items-center gap-2 transition-all shadow-lg hover:shadow-purple-500/10 text-sm"
                >
                  {savingPlatform ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {d.saveStatusSaving}
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {d.savePlatformSettings}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: Plans Management */}
        {/* ======================================================== */}
        {activeTab === 'plans' && (
          <div className="space-y-6">
            
            {/* Tab Header Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-850/20 p-4 border border-gray-850 rounded-2xl">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Activity className="text-purple-400" size={22} />
                  {d.plansSectionTitle}
                </h2>
                <p className="text-gray-400 text-sm mt-1">{d.plansSectionDesc}</p>
              </div>

              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-sm shadow-md transition-all shrink-0"
              >
                {showAddForm ? <X size={16} /> : <Plus size={16} />}
                {showAddForm ? d.cancel : d.addPlan}
              </button>
            </div>

            {/* Add Plan Form */}
            {showAddForm && (
              <div className="bg-gray-850/60 border border-purple-500/20 rounded-2xl p-6 md:p-8 max-w-4xl animate-fade-in shadow-[0_0_20px_rgba(168,85,247,0.03)]">
                <h3 className="text-lg font-bold text-purple-400 mb-6 flex items-center gap-2 border-b border-gray-800 pb-3">
                  <Plus size={20} />
                  {d.addPlan}
                </h3>

                <form onSubmit={handleAddPlan} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Name */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300 block">{d.planName}</label>
                      <input
                        type="text"
                        value={newPlanName}
                        onChange={(e) => setNewPlanName(e.target.value)}
                        placeholder="e.g. Enterprise"
                        required
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-purple-500 transition-all text-sm"
                      />
                    </div>

                    {/* Slug */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300 block">{d.planSlug}</label>
                      <input
                        type="text"
                        value={newPlanSlug}
                        onChange={(e) => setNewPlanSlug(e.target.value)}
                        placeholder="e.g. enterprise"
                        required
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-purple-500 transition-all text-sm font-mono"
                      />
                    </div>

                    {/* Commission Rate */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300 block">{d.commissionRate}</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={newCommissionRate}
                        onChange={(e) => setNewCommissionRate(Number(e.target.value))}
                        required
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-purple-500 transition-all text-sm font-mono"
                      />
                    </div>

                    {/* Monthly Price */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300 block">{d.monthlyPrice}</label>
                      <div className="relative">
                        <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                          type="number"
                          min="0"
                          value={newPriceMonthly}
                          onChange={(e) => setNewPriceMonthly(Number(e.target.value))}
                          required
                          className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-8 pr-4 py-2.5 text-white outline-none focus:border-purple-500 transition-all text-sm font-mono"
                        />
                      </div>
                    </div>

                    {/* Yearly Price */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300 block">{d.yearlyPrice}</label>
                      <div className="relative">
                        <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                          type="number"
                          min="0"
                          value={newPriceYearly}
                          onChange={(e) => setNewPriceYearly(Number(e.target.value))}
                          required
                          className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-8 pr-4 py-2.5 text-white outline-none focus:border-purple-500 transition-all text-sm font-mono"
                        />
                      </div>
                    </div>

                    {/* Messages Limit */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300 block">{d.pMessagesLimit}</label>
                      <input
                        type="number"
                        min="-1"
                        value={newMessagesLimit}
                        onChange={(e) => setNewMessagesLimit(Number(e.target.value))}
                        required
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-purple-500 transition-all text-sm font-mono"
                      />
                    </div>

                    {/* Voice Minutes Limit */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300 block">{d.pVoiceMinutesLimit}</label>
                      <input
                        type="number"
                        min="-1"
                        value={newVoiceLimit}
                        onChange={(e) => setNewVoiceLimit(Number(e.target.value))}
                        required
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-purple-500 transition-all text-sm font-mono"
                      />
                    </div>

                    {/* Reminder Credits */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300 block">{d.pReminderCredits}</label>
                      <input
                        type="number"
                        min="0"
                        value={newReminderCredits}
                        onChange={(e) => setNewReminderCredits(Number(e.target.value))}
                        required
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-purple-500 transition-all text-sm font-mono"
                      />
                    </div>

                  </div>

                  <div className="flex gap-4 items-center pt-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="newReminderEnabled"
                        checked={newReminderEnabled}
                        onChange={(e) => setNewReminderEnabled(e.target.checked)}
                        className="accent-purple-500 w-4 h-4"
                      />
                      <label htmlFor="newReminderEnabled" className="text-xs text-gray-300 cursor-pointer">
                        {d.reminderEnabled}
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="newVoiceReminderEnabled"
                        checked={newVoiceReminderEnabled}
                        onChange={(e) => setNewVoiceReminderEnabled(e.target.checked)}
                        className="accent-purple-500 w-4 h-4"
                      />
                      <label htmlFor="newVoiceReminderEnabled" className="text-xs text-gray-300 cursor-pointer">
                        {d.voiceReminderEnabled}
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end border-t border-gray-800 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm"
                    >
                      {d.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={addingPlan}
                      className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
                    >
                      {addingPlan && <Loader2 size={14} className="animate-spin" />}
                      {d.submit}
                    </button>
                  </div>
                </form>
              </div>
            )}

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
                      ${isActive ? 'bg-gray-850/80 border-gray-800' : 'bg-gray-900/40 border-gray-850 opacity-80'}
                      ${isVIP && isActive ? 'border-purple-500/45 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : ''}
                      transition-all duration-300 group
                    `}
                  >
                    
                    {/* Delete Plan Button (Stealth Delete, visible on card hover) */}
                    <button
                      onClick={() => handleDeletePlan(plan.id)}
                      disabled={deletingPlanId === plan.id}
                      className="absolute top-4 right-4 p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
                      title={d.deletePlan}
                    >
                      {deletingPlanId === plan.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>

                    {/* Header: Name and Status Toggle */}
                    <div className="flex justify-between items-start mb-5 pt-2">
                      <div>
                        <h3 className={`text-xl font-bold uppercase ${isVIP ? 'text-purple-400' : 'text-white'}`}>
                          {plan.name || plan.slug.toUpperCase()}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                          <span className="text-[11px] text-gray-400">
                            {isActive ? d.isActive : d.isInactive}
                          </span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleToggleStatus(plan.id, plan.is_active)}
                        disabled={togglingPlanId === plan.id}
                        className={`
                          p-2 rounded-lg text-sm transition-colors border shrink-0
                          ${isActive 
                            ? 'bg-red-500/10 text-red-400 border-red-500/15 hover:bg-red-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15 hover:bg-emerald-500/20'}
                        `}
                      >
                        {togglingPlanId === plan.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : isActive ? (
                          <X size={14} />
                        ) : (
                          <Check size={14} />
                        )}
                      </button>
                    </div>

                    {/* Pricing Box */}
                    <div className="mb-5 p-4 rounded-xl bg-gray-900/60 border border-gray-850">
                      {isEditing ? (
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] text-gray-500 mb-1 block uppercase font-bold tracking-wider">
                              {d.monthlyPrice}
                            </label>
                            <div className="relative">
                              <DollarSign size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input 
                                type="number"
                                value={editPriceMonthly}
                                onChange={(e) => setEditPriceMonthly(Number(e.target.value))}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-1.5 text-white outline-none focus:border-purple-500 text-sm font-mono"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 mb-1 block uppercase font-bold tracking-wider">
                              {d.yearlyPrice}
                            </label>
                            <div className="relative">
                              <DollarSign size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input 
                                type="number"
                                value={editPriceYearly}
                                onChange={(e) => setEditPriceYearly(Number(e.target.value))}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-1.5 text-white outline-none focus:border-purple-500 text-sm font-mono"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button 
                              onClick={() => savePricing(plan.id)}
                              disabled={savingPricingId === plan.id}
                              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-1.5 flex justify-center items-center gap-1 text-xs font-semibold"
                            >
                              {savingPricingId === plan.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                              {d.editPricing.split(' ')[0]}
                            </button>
                            <button 
                              onClick={() => setEditingId(null)}
                              className="px-3 bg-gray-850 hover:bg-gray-800 text-white rounded-lg py-1.5 text-xs"
                            >
                              {d.cancel}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="flex items-baseline gap-0.5">
                              <span className="text-2xl font-black text-white font-mono">${plan.price_monthly}</span>
                              <span className="text-gray-500 text-xs">/m</span>
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5 font-mono">
                              ${plan.price_yearly} /yr
                            </div>
                          </div>
                          <button 
                            onClick={() => startEditing(plan)}
                            className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-750 shrink-0"
                            title={d.editPricing}
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Specific limits & stats */}
                    <div className="space-y-3 flex-1">
                      
                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-3 p-3 bg-gray-900/30 rounded-xl border border-gray-850/60 text-xs">
                        <div className="flex flex-col">
                          <span className="text-gray-500 flex items-center gap-1 mb-0.5"><Users size={12}/> Agencies</span>
                          <span className="font-semibold text-white font-mono">{plan.agencies_count || 0}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-500 flex items-center gap-1 mb-0.5"><Activity size={12}/> Revenue</span>
                          <span className="font-semibold text-emerald-400 font-mono">${plan.revenue || 0}</span>
                        </div>
                      </div>

                      {/* Threshold limits list */}
                      <div className="space-y-2 border-t border-gray-850 pt-3 text-[13px]">
                        
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">{d.messagesLimit}</span>
                          <span className="font-bold font-mono text-white">
                            {plan.messages_limit === -1 ? d.unlimited : plan.messages_limit.toLocaleString()}
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">{d.voiceMinutesLimit}</span>
                          <span className="font-bold font-mono text-white">
                            {plan.voice_minutes_limit === -1 ? d.unlimited : `${plan.voice_minutes_limit} ${d.minutes}`}
                          </span>
                        </div>

                        {/* Guaranteed commission_rate fetched from database via RPC */}
                        <div className="flex justify-between items-center border-t border-gray-850/50 pt-2 text-xs">
                          <span className="text-purple-400/90 font-medium flex items-center gap-1">
                            <Info size={12} className="text-purple-400" />
                            {d.commissionRate}
                          </span>
                          <span className="font-bold font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/15">
                            {plan.commission_rate}%
                          </span>
                        </div>

                      </div>

                    </div>

                  </div>
                )
              })}
            </div>

            {plans.length === 0 && (
              <div className="text-center py-20 text-gray-500 border border-dashed border-gray-850 rounded-2xl">
                <Shield size={48} className="mx-auto mb-4 opacity-50 text-purple-500" />
                <p className="text-sm font-medium">{d.noPlans}</p>
              </div>
            )}

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: Security */}
        {/* ======================================================== */}
        {activeTab === 'security' && (
          <div className="bg-gray-850/40 border border-gray-800/80 rounded-2xl p-6 md:p-8 space-y-6 max-w-4xl">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Lock className="text-purple-400" size={22} />
                {d.securitySectionTitle}
              </h2>
              <p className="text-gray-400 text-sm mt-1">{d.securitySectionDesc}</p>
            </div>

            <div className="space-y-4">
              
              {/* Failed Logins Alert Widget */}
              <div className={`p-5 rounded-2xl border flex items-start gap-4 ${
                failedLoginsCount > 0 
                  ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                <div className={`p-3 rounded-xl shrink-0 ${
                  failedLoginsCount > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'
                }`}>
                  {failedLoginsCount > 0 ? (
                    <ShieldAlert size={24} className="text-red-400" />
                  ) : (
                    <Shield size={24} className="text-emerald-400" />
                  )}
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-base">
                    {d.failedLogins}: <span className="font-mono">{failedLoginsCount}</span>
                  </h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {d.failedLoginsDesc}
                  </p>
                </div>
              </div>

              {/* Profiles Metadata details */}
              <div className="bg-gray-900/60 border border-gray-850 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Info size={16} className="text-purple-400" />
                  {d.securityInfo}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  
                  {/* Master ID */}
                  <div className="space-y-1 border-b border-gray-850 pb-3 md:border-none md:pb-0">
                    <span className="text-gray-400 block text-xs font-semibold uppercase">{d.masterAdminId}</span>
                    <span className="font-mono text-white text-xs select-all bg-gray-950 px-2 py-1 rounded border border-gray-850 block w-full mt-1">
                      {user?.id || '—'}
                    </span>
                  </div>

                  {/* Last Login Date */}
                  <div className="space-y-1">
                    <span className="text-gray-400 block text-xs font-semibold uppercase">{d.lastSignIn}</span>
                    <span className="text-white font-medium block mt-1">
                      {formatTimestamp(user?.last_sign_in_at)}
                    </span>
                  </div>

                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  )
}
