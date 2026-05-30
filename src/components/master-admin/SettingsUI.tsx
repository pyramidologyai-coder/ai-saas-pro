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
  intended_for?: 'agency' | 'business' | 'both'
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
    intendedFor: 'الفئة المستهدفة',
    optionAgency: 'الوكالات فقط (Agency)',
    optionBusiness: 'العملاء المباشرين (Business Direct)',
    optionBoth: 'كلاهما (Both)',
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
    intendedFor: 'Intended For',
    optionAgency: 'Agencies Only (Agency)',
    optionBusiness: 'Direct Businesses (Business Direct)',
    optionBoth: 'Both (Agency & Direct)',
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
    intendedFor: 'Destiné à',
    optionAgency: 'Agences Uniquement',
    optionBusiness: 'Clients Directs',
    optionBoth: 'Les deux',
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
  const [activeTab, setActiveTab] = useState<'platform' | 'security'>('platform')

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
        window.dispatchEvent(new CustomEvent('platform-name-updated', { detail: platformName }));
      }

      router.refresh()
    } catch (err: any) {
      console.error(err)
      setPlatformMessage({ text: d.errorSave + ': ' + err.message, type: 'error' })
    } finally {
      setSavingPlatform(false)
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
