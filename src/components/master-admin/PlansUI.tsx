'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { 
  Check, X, Edit2, Save, Loader2, Key, Activity, 
  DollarSign, Users, Shield, Plus, Trash2, Info, Globe, Archive, Calendar
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
  archived_at?: string | null
  expires_at?: string | null
}

interface PlansUIProps {
  initialPlans: Plan[]
  initialLang: string
}

const DICTIONARY = {
  ar: {
    title: 'إدارة باقات المنصة (Master Plans)',
    subtitle: 'التحكم في أسعار وتفعيل وباقات الوكالات والعملاء المباشرين، وإدارة الحدود القصوى للاستخدام ونسب العمولات.',
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
    plansSectionDesc: 'إدارة الباقات، تحديد فئاتها وسقوف الاستخدام الخاصة بها.',
    
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
    
    // Messages & States
    successSave: 'تم حفظ الأسعار بنجاح ✓',
    errorSave: 'حدث خطأ أثناء التحديث',
    successAddPlan: 'تم إضافة الباقة بنجاح ✓',
    errorAddPlan: 'حدث خطأ أثناء إضافة الباقة',
    successDeletePlan: 'تم حذف الباقة بنجاح ✓',
    errorDeletePlan: 'حدث خطأ أثناء حذف الباقة',
    noPlans: 'لا توجد باقات معروضة حالياً.',
    loading: 'جاري التحميل...',
    unlimited: 'غير محدود',
    minutes: 'دقيقة',
    vipNotice: 'ميزة حصرية: أصحاب هذه الباقة يمكنهم إضافة (API Keys) الخاصة بهم (مثل Meta Token و Gemini) للعمل بشكل مستقل تماماً.',

    // Archive Strings
    archivePlan: 'أرشفة الباقة',
    archivedBadge: 'مؤرشفة 📦',
    confirmArchive: 'هل أنت متأكد من أرشفة هذه الباقة؟ لن يتمكن مشتركون جدد من الانضمام إليها، لكن المشتركين الحاليين لن يتأثروا.',
    archiveWarningTitle: 'تنبيه قبل الأرشفة 📦',
    agenciesCountLabel: 'الوكالات المشتركة حالياً:',
    clientsCountLabel: 'العملاء المباشرون المتأثرون:',
    archiveWarningText: 'تنبيه: الوكالات والعملاء الموجودين حالياً على الباقة سيبقون عليها دون أي تغيير — ولكن لن يتمكن أي مستخدم جديد من الاشتراك فيها مستقبلاً.',
    confirmButton: 'تأكيد الأرشفة',
    cancelButton: 'إلغاء',
    successArchivePlan: 'تم أرشفة الباقة بنجاح ✓',
    errorArchivePlan: 'حدث خطأ أثناء أرشفة الباقة',
    filterActive: 'الباقات النشطة',
    filterArchived: 'الباقات المؤرشفة',
    filterAll: 'الكل'
  },
  en: {
    title: 'Platform Plans Management',
    subtitle: 'Manage prices, activation status, usage limits, and custom commission rates for agencies and direct businesses.',
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
    plansSectionDesc: 'Manage prices, set targets, and define limits for the system plans.',
    
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
    
    // Messages & States
    successSave: 'Prices updated successfully ✓',
    errorSave: 'An error occurred while saving pricing',
    successAddPlan: 'Plan added successfully ✓',
    errorAddPlan: 'An error occurred while adding the plan',
    successDeletePlan: 'Plan deleted successfully ✓',
    errorDeletePlan: 'An error occurred while deleting the plan',
    noPlans: 'No plans found.',
    loading: 'Loading...',
    unlimited: 'Unlimited',
    minutes: 'min',
    vipNotice: 'Exclusive feature: Users of this plan can bring their own API keys (Meta Token, Gemini API Key) to work fully autonomously.',

    // Archive Strings
    archivePlan: 'Archive Plan',
    archivedBadge: 'Archived 📦',
    confirmArchive: 'Are you sure you want to archive this plan? New subscribers won\'t be able to join, but existing subscribers will remain unaffected.',
    archiveWarningTitle: 'Pre-Archive Warning 📦',
    agenciesCountLabel: 'Agencies currently subscribed:',
    clientsCountLabel: 'Affected direct clients:',
    archiveWarningText: 'Notice: Existing agencies and clients will keep their plan without change, but no new users can subscribe to it in the future.',
    confirmButton: 'Confirm Archive',
    cancelButton: 'Cancel',
    successArchivePlan: 'Plan archived successfully ✓',
    errorArchivePlan: 'An error occurred while archiving the plan',
    filterActive: 'Active Plans',
    filterArchived: 'Archived Plans',
    filterAll: 'All'
  },
  fr: {
    title: 'Gestion des Forfaits (Master)',
    subtitle: 'Gérer la tarification, l\'activation, les limites d\'utilisation et les commissions pour les agences et clients directs.',
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
    reminderCredits: 'Crédits de rappels',
    isActive: 'Actif',
    isInactive: 'Inactif',
    confirmDelete: 'Êtes-vous sûr de supprimer ce forfait ? Cette action est irréversible.',
    plansSectionTitle: 'Forfaits et limites de consommation',
    plansSectionDesc: 'Gérer les prix des forfaits, définir les cibles et spécifier les limites.',
    
    // Add Plan Form
    planName: 'Nom du forfait',
    planSlug: 'Slug du forfait',
    pMessagesLimit: 'Limite de messages (Saisir -1 pour illimité)',
    pVoiceMinutesLimit: 'Limite de minutes vocales (Saisir -1 pour illimité)',
    pReminderCredits: 'Crédits de rappel gratuits',
    intendedFor: 'Destiné à',
    optionAgency: 'Agences uniquement (Agency)',
    optionBusiness: 'Entreprises directes (Business Direct)',
    optionBoth: 'Les deux (Both)',
    submit: 'Ajouter le forfait maintenant',
    cancel: 'Annuler',
    
    // Messages & States
    successSave: 'Tarifs enregistrés avec succès ✓',
    errorSave: 'Une erreur est survenue lors de l\'enregistrement',
    successAddPlan: 'Forfait ajouté avec succès ✓',
    errorAddPlan: 'Une erreur est survenue lors de l\'ajout',
    successDeletePlan: 'Forfait supprimé avec succès ✓',
    errorDeletePlan: 'Une erreur est survenue lors de la suppression',
    noPlans: 'Aucun forfait trouvé.',
    loading: 'Chargement...',
    unlimited: 'Illimité',
    minutes: 'min',
    vipNotice: 'Fonctionnalité exclusive: Les utilisateurs de ce forfait peuvent ajouter leurs propres clés API (Meta, Gemini) pour travailler de manière autonome.',

    // Archive Strings
    archivePlan: 'Archiver le forfait',
    archivedBadge: 'Archivé 📦',
    confirmArchive: 'Êtes-vous sûr de vouloir archiver ce forfait ? Aucun nouvel abonné ne pourra y adhérer, mais les abonnés existants ne seront pas affectés.',
    archiveWarningTitle: 'Avertissement avant archivage 📦',
    agenciesCountLabel: 'Agences actuellement abonnées :',
    clientsCountLabel: 'Clients directs affectés :',
    archiveWarningText: 'Remarque : Les agences et clients existants conserveront leur forfait sans changement, mais aucun nouvel utilisateur ne pourra s\'y abonner à l\'avenir.',
    confirmButton: 'Confirmer l\'archivage',
    cancelButton: 'Annuler',
    successArchivePlan: 'Forfait archivé avec succès ✓',
    errorArchivePlan: 'Une erreur est survenue lors de l\'archivage',
    filterActive: 'Forfaits actifs',
    filterArchived: 'Forfaits archivés',
    filterAll: 'Tout'
  }
} as const

export function PlansUI({ initialPlans, initialLang }: PlansUIProps) {
  const router = useRouter()
  const supabase = createClient()
  const [lang, setLang] = useState<Lang>(initialLang as Lang)
  const [isPending, startTransition] = useTransition()
  const isRTL = lang === 'ar'
  const d = DICTIONARY[lang]

  const [plans, setPlans] = useState<Plan[]>(initialPlans)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Edit State
  const [editPriceMonthly, setEditPriceMonthly] = useState<number>(0)
  const [editPriceYearly, setEditPriceYearly] = useState<number>(0)
  
  // Loading States
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
  const [newIntendedFor, setNewIntendedFor] = useState<'agency' | 'business' | 'both'>('both')
  const [newExpiresAt, setNewExpiresAt] = useState<string | null>(null)
  const [addingPlan, setAddingPlan] = useState(false)

  // Archive & Filter States
  const [filterMode, setFilterMode] = useState<'active' | 'archived' | 'all'>('active')
  const [archivingPlan, setArchivingPlan] = useState<Plan | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageData, setUsageData] = useState<{ agencies_count: number, tenants_count: number } | null>(null)
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false)
  const [archivingInProgress, setArchivingInProgress] = useState(false)

  // Actions
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
        p_intended_for: newIntendedFor,
        p_reminder_enabled: newReminderEnabled,
        p_voice_reminder_enabled: newVoiceReminderEnabled,
        p_reminder_credits: newReminderCredits,
        p_expires_at: newExpiresAt
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
        setNewIntendedFor('both')
        setNewExpiresAt(null)

        // Reload plans
        const [plansRes, statsRes] = await Promise.all([
          supabase.from('plans').select('*'),
          supabase.rpc('get_plans_with_stats')
        ])
        
        if (plansRes.data) {
          const statsList = statsRes.data || []
          const merged = plansRes.data.map((p: any) => {
            const stats = statsList.find((s: any) => s.id === p.id) || {}
            return {
              ...p,
              agencies_count: stats.agencies_count || 0,
              revenue: stats.revenue || 0
            }
          })
          setPlans(merged)
        }
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

  const handleArchivePlanUsageCheck = async (plan: Plan) => {
    if (!isValidUUID(plan.id)) return
    setUsageLoading(true)
    setArchivingPlan(plan)
    
    try {
      const { data, error } = await supabase.rpc('get_plan_usage', {
        p_plan_slug: plan.slug
      })

      if (error) {
        console.error("Error checking plan usage:", error)
        alert(d.errorSave)
      } else {
        setUsageData({
          agencies_count: data?.agencies_count || 0,
          tenants_count: data?.tenants_count || 0
        })
        setIsArchiveModalOpen(true)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setUsageLoading(false)
    }
  }

  const confirmArchivePlan = async () => {
    if (!archivingPlan) return
    setArchivingInProgress(true)
    
    try {
      const { data, error } = await supabase.rpc('archive_plan', {
        p_plan_id: archivingPlan.id
      })

      if (error || (data && !data.success)) {
        const errorMsg = error ? error.message : (data ? data.error : d.errorArchivePlan)
        alert(d.errorArchivePlan + ': ' + errorMsg)
      } else {
        alert(d.successArchivePlan)
        setPlans(prev => prev.map(p => 
          p.id === archivingPlan.id ? { ...p, is_active: false, archived_at: new Date().toISOString() } : p
        ))
        setIsArchiveModalOpen(false)
        setArchivingPlan(null)
        setUsageData(null)
        router.refresh()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setArchivingInProgress(false)
    }
  }

  const renderFeatures = (features: PlanFeature[], slug: string) => {
    if (!features || features.length === 0) return (
      <div className="text-gray-500 text-xs">Default feature limits apply</div>
    )
    return (
      <ul className="space-y-2 mt-4 text-xs text-gray-300">
        {features.map(f => (
          <li key={f.id} className="flex items-center gap-2">
            <Check size={12} className="text-emerald-400" />
            <span>{f.feature_key}: {String(f.feature_value)}</span>
          </li>
        ))}
      </ul>
    )
  }

  const filteredPlans = plans.filter(p => {
    if (filterMode === 'active') return !p.archived_at
    if (filterMode === 'archived') return !!p.archived_at
    return true
  })

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-8 max-w-7xl mx-auto text-[var(--text-main)] min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-[var(--glass-border)]">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-main)] flex items-center gap-3">
            <Shield className="text-purple-500" size={32} />
            {d.title}
          </h1>
          <p className="text-[var(--text-dim)] mt-2 text-sm max-w-2xl leading-relaxed">
            {d.subtitle}
          </p>
        </div>

        {/* Action Buttons & Language selector */}
        <div className="flex flex-wrap items-center gap-4 self-end md:self-auto">
          {/* Language selector */}
          <div className="flex items-center gap-2 bg-[var(--bg-input)] p-1 rounded-xl border border-[var(--glass-border)]">
            <button
              onClick={() => startTransition(() => setLang('ar'))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                lang === 'ar' ? 'bg-purple-600 text-white shadow-lg' : 'text-[var(--text-dim)] hover:text-[var(--text-bright)]'
              }`}
            >
              العربية
            </button>
            <button
              onClick={() => startTransition(() => setLang('en'))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                lang === 'en' ? 'bg-purple-600 text-white shadow-lg' : 'text-[var(--text-dim)] hover:text-[var(--text-bright)]'
              }`}
            >
              English
            </button>
            <button
              onClick={() => startTransition(() => setLang('fr'))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                lang === 'fr' ? 'bg-purple-600 text-white shadow-lg' : 'text-[var(--text-dim)] hover:text-[var(--text-bright)]'
              }`}
            >
              Français
            </button>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-sm shadow-md transition-all shrink-0"
          >
            {showAddForm ? <X size={16} /> : <Plus size={16} />}
            {showAddForm ? d.cancel : d.addPlan}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 bg-[var(--bg-input)] p-1.5 rounded-xl border border-[var(--glass-border)] w-fit">
        <button
          onClick={() => setFilterMode('active')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            filterMode === 'active' ? 'bg-purple-600 text-white shadow-lg' : 'text-[var(--text-dim)] hover:text-[var(--text-bright)]'
          }`}
        >
          {d.filterActive}
        </button>
        <button
          onClick={() => setFilterMode('archived')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            filterMode === 'archived' ? 'bg-purple-600 text-white shadow-lg' : 'text-[var(--text-dim)] hover:text-[var(--text-bright)]'
          }`}
        >
          {d.filterArchived}
        </button>
        <button
          onClick={() => setFilterMode('all')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            filterMode === 'all' ? 'bg-purple-600 text-white shadow-lg' : 'text-[var(--text-dim)] hover:text-[var(--text-bright)]'
          }`}
        >
          {d.filterAll}
        </button>
      </div>

      {/* Add Plan Form Box */}
      {showAddForm && (
        <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-6 md:p-8 max-w-4xl animate-fade-in shadow-[var(--glow)]">
          <h3 className="text-lg font-bold text-purple-400 mb-6 flex items-center gap-2 border-b border-[var(--glass-border)] pb-3">
            <Plus size={20} />
            {d.addPlan}
          </h3>

          <form onSubmit={handleAddPlan} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Name */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-dim)] block">{d.planName}</label>
                <input
                  type="text"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  placeholder="e.g. Enterprise"
                  required
                  className="w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-[var(--text-main)] outline-none focus:border-purple-500 transition-all text-sm"
                />
              </div>

              {/* Slug */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-dim)] block">{d.planSlug}</label>
                <input
                  type="text"
                  value={newPlanSlug}
                  onChange={(e) => setNewPlanSlug(e.target.value)}
                  placeholder="e.g. enterprise"
                  required
                  className="w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-[var(--text-main)] outline-none focus:border-purple-500 transition-all text-sm font-mono"
                />
              </div>

              {/* Commission Rate */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-dim)] block">{d.commissionRate}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newCommissionRate}
                  onChange={(e) => setNewCommissionRate(Number(e.target.value))}
                  required
                  className="w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-[var(--text-main)] outline-none focus:border-purple-500 transition-all text-sm font-mono"
                />
              </div>

              {/* Monthly Price */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-dim)] block">{d.monthlyPrice}</label>
                <div className="relative">
                  <DollarSign size={14} className={`absolute ${isRTL ? 'left-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-500`} />
                  <input
                    type="number"
                    min="0"
                    value={newPriceMonthly}
                    onChange={(e) => setNewPriceMonthly(Number(e.target.value))}
                    required
                    className="w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl pl-8 pr-4 py-2.5 text-[var(--text-main)] outline-none focus:border-purple-500 transition-all text-sm font-mono"
                  />
                </div>
              </div>

              {/* Yearly Price */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-dim)] block">{d.yearlyPrice}</label>
                <div className="relative">
                  <DollarSign size={14} className={`absolute ${isRTL ? 'left-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-500`} />
                  <input
                    type="number"
                    min="0"
                    value={newPriceYearly}
                    onChange={(e) => setNewPriceYearly(Number(e.target.value))}
                    required
                    className="w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl pl-8 pr-4 py-2.5 text-[var(--text-main)] outline-none focus:border-purple-500 transition-all text-sm font-mono"
                  />
                </div>
              </div>

              {/* Messages Limit */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-dim)] block">{d.pMessagesLimit}</label>
                <input
                  type="number"
                  min="-1"
                  value={newMessagesLimit}
                  onChange={(e) => setNewMessagesLimit(Number(e.target.value))}
                  required
                  className="w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-[var(--text-main)] outline-none focus:border-purple-500 transition-all text-sm font-mono"
                />
              </div>

              {/* Voice Minutes Limit */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-dim)] block">{d.pVoiceMinutesLimit}</label>
                <input
                  type="number"
                  min="-1"
                  value={newVoiceLimit}
                  onChange={(e) => setNewVoiceLimit(Number(e.target.value))}
                  required
                  className="w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-[var(--text-main)] outline-none focus:border-purple-500 transition-all text-sm font-mono"
                />
              </div>

              {/* Reminder Credits */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-dim)] block">{d.pReminderCredits}</label>
                <input
                  type="number"
                  min="0"
                  value={newReminderCredits}
                  onChange={(e) => setNewReminderCredits(Number(e.target.value))}
                  required
                  className="w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-[var(--text-main)] outline-none focus:border-purple-500 transition-all text-sm font-mono"
                />
              </div>

              {/* Intended For */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-dim)] block">{d.intendedFor}</label>
                <select
                  value={newIntendedFor}
                  onChange={(e) => setNewIntendedFor(e.target.value as any)}
                  required
                  className="w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-[var(--text-main)] outline-none focus:border-purple-500 transition-all text-sm"
                >
                  <option value="both" style={{ background: 'var(--bg-color)', color: 'var(--text-main)' }}>{d.optionBoth}</option>
                  <option value="agency" style={{ background: 'var(--bg-color)', color: 'var(--text-main)' }}>{d.optionAgency}</option>
                  <option value="business" style={{ background: 'var(--bg-color)', color: 'var(--text-main)' }}>{d.optionBusiness}</option>
                </select>
              </div>

              {/* Expiry Date */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-dim)] block">
                  {lang === 'ar' ? 'تاريخ انتهاء الباقة (اختياري)' : lang === 'fr' ? 'Date d\'expiration (optionnel)' : 'Expiry Date (Optional)'}
                </label>
                <input
                  type="date"
                  value={newExpiresAt || ''}
                  onChange={(e) => setNewExpiresAt(e.target.value || null)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-[var(--text-main)] outline-none focus:border-purple-500 transition-all text-sm font-mono scheme-dark"
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
                  className="accent-purple-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="newReminderEnabled" className="text-xs text-[var(--text-dim)] cursor-pointer">
                  {d.reminderEnabled}
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="newVoiceReminderEnabled"
                  checked={newVoiceReminderEnabled}
                  onChange={(e) => setNewVoiceReminderEnabled(e.target.checked)}
                  className="accent-purple-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="newVoiceReminderEnabled" className="text-xs text-[var(--text-dim)] cursor-pointer">
                  {d.voiceReminderEnabled}
                </label>
              </div>
            </div>

            <div className="flex gap-3 justify-end border-t border-[var(--glass-border)] pt-4">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-[var(--bg-input)] hover:bg-[var(--hover-bg)] text-[var(--text-main)] border border-[var(--glass-border)] rounded-lg text-sm transition-colors"
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
        {filteredPlans.map((plan) => {
          const isEditing = editingId === plan.id
          const isVIP = plan.slug === 'vip'
          const isActive = plan.is_active

          return (
            <div 
              key={plan.id}
              className={`
                relative flex flex-col rounded-2xl border p-6 overflow-hidden
                ${plan.archived_at 
                  ? 'bg-[var(--card-bg)]/40 border-[var(--glass-border)] opacity-60 filter grayscale-[20%]' 
                  : isActive 
                    ? 'bg-[var(--card-bg)] border-[var(--glass-border)] shadow-[var(--glow)]' 
                    : 'bg-[var(--card-bg)]/60 border-[var(--glass-border)] opacity-80'
                }
                ${isVIP && isActive && !plan.archived_at ? 'border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : ''}
                transition-all duration-300 group
              `}
            >
              
              {/* Archive Plan Button (Stealth Archive, visible on card hover) */}
              {!plan.archived_at && (
                <button
                  onClick={() => handleArchivePlanUsageCheck(plan)}
                  disabled={usageLoading && archivingPlan?.id === plan.id}
                  className="absolute top-4 right-4 p-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-yellow-500/20"
                  title={d.archivePlan}
                >
                  {usageLoading && archivingPlan?.id === plan.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Archive size={14} />
                  )}
                </button>
              )}

              {/* Header: Name, intended_for, and Status Toggle */}
              <div className="flex justify-between items-start mb-6 pt-2">
                <div>
                  <h3 className={`text-xl font-bold uppercase ${isVIP ? 'text-purple-400' : 'text-[var(--text-main)]'}`}>
                    {plan.name || plan.slug.toUpperCase()}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {plan.archived_at ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-650/20 text-[var(--text-dim)] border border-gray-650/30 shadow-[0_0_8px_rgba(156,163,175,0.05)]">
                        {d.archivedBadge}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-[11px] text-[var(--text-dim)]">
                          {isActive ? d.isActive : d.isInactive}
                        </span>
                      </div>
                    )}
                    
                    {/* Color-coded Target Badges */}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                      plan.intended_for === 'agency'
                        ? 'bg-purple-500/15 text-purple-400 border-purple-500/25 shadow-[0_0_8px_rgba(168,85,247,0.1)]'
                        : plan.intended_for === 'business'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25 shadow-[0_0_8px_rgba(16,185,129,0.1)]'
                        : 'bg-blue-500/15 text-blue-400 border-blue-500/25 shadow-[0_0_8px_rgba(59,130,246,0.1)]'
                    }`}>
                      {plan.intended_for === 'agency'
                        ? (isRTL ? '🏢 وكالة' : '🏢 Agency')
                        : plan.intended_for === 'business'
                        ? (isRTL ? '🩺 عميل مباشر' : '🩺 Business Direct')
                        : (isRTL ? '🌐 كلاهما' : '🌐 Both')}
                    </span>

                    {/* Expiry Calendar Badge */}
                    {plan.expires_at && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/15 flex items-center gap-1 shadow-[0_0_8px_rgba(234,179,8,0.05)]">
                        <Calendar size={10} className="shrink-0" />
                        <span>
                          {isRTL ? 'ينتهي: ' : 'Expires: '}
                          {new Date(plan.expires_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                
                {!plan.archived_at && (
                  <button
                    onClick={() => handleToggleStatus(plan.id, plan.is_active)}
                    disabled={togglingPlanId === plan.id}
                    className={`
                      p-2 rounded-lg text-sm transition-colors border shrink-0
                      ${isActive 
                        ? 'bg-red-500/10 text-red-400 border-red-500/15 hover:bg-red-500/20' 
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15 hover:bg-emerald-500/20'}
                    `}
                    title={isActive ? d.isInactive : d.isActive}
                  >
                    {togglingPlanId === plan.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : isActive ? (
                      <X size={14} />
                    ) : (
                      <Check size={14} />
                    )}
                  </button>
                )}
              </div>

              {/* Pricing Section */}
              <div className="mb-6 p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--glass-border)]">
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-[var(--text-dim)] mb-1 block uppercase font-bold tracking-wider">{d.monthlyPrice}</label>
                      <div className="relative">
                        <DollarSign size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                        <input 
                          type="number"
                          value={editPriceMonthly}
                          onChange={(e) => setEditPriceMonthly(Number(e.target.value))}
                          className="w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-lg pl-7 pr-3 py-1.5 text-[var(--text-main)] outline-none focus:border-purple-500 text-sm font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--text-dim)] mb-1 block uppercase font-bold tracking-wider">{d.yearlyPrice}</label>
                      <div className="relative">
                        <DollarSign size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                        <input 
                          type="number"
                          value={editPriceYearly}
                          onChange={(e) => setEditPriceYearly(Number(e.target.value))}
                          className="w-full bg-[var(--bg-input)] border border-[var(--glass-border)] rounded-lg pl-7 pr-3 py-1.5 text-[var(--text-main)] outline-none focus:border-purple-500 text-sm font-mono"
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
                        className="px-3 bg-[var(--hover-bg)] hover:bg-[var(--bg-input)] text-[var(--text-main)] border border-[var(--glass-border)] rounded-lg py-1.5 text-xs transition-colors"
                      >
                        {d.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center group">
                    <div>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-2xl font-black text-[var(--text-main)] font-mono">${plan.price_monthly}</span>
                        <span className="text-[var(--text-dim)] text-xs">/m</span>
                      </div>
                      <div className="text-xs text-[var(--text-dim)] mt-0.5 font-mono">
                        ${plan.price_yearly} /yr
                      </div>
                    </div>
                    {!plan.archived_at && (
                      <button 
                        onClick={() => startEditing(plan)}
                        className="p-2 bg-[var(--bg-input)] hover:bg-[var(--hover-bg)] text-[var(--text-main)] border border-[var(--glass-border)] rounded-lg shrink-0 transition-colors"
                        title={d.editPricing}
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Specific limits & stats */}
              <div className="space-y-4 flex-1">
                
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--bg-input)]/50 rounded-xl border border-[var(--glass-border)] text-xs">
                  <div className="flex flex-col">
                    <span className="text-[var(--text-dim)] flex items-center gap-1 mb-0.5"><Users size={12}/> Agencies</span>
                    <span className="font-semibold text-[var(--text-main)] font-mono">{plan.agencies_count || 0}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[var(--text-dim)] flex items-center gap-1 mb-0.5"><Activity size={12}/> Revenue</span>
                    <span className="font-semibold text-emerald-400 font-mono">${plan.revenue || 0}</span>
                  </div>
                </div>

                {/* Threshold limits list */}
                <div className="space-y-2.5 border-t border-[var(--glass-border)] pt-3.5 text-[13px]">
                  
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--text-dim)]">{d.messagesLimit}</span>
                    <span className="font-bold font-mono text-[var(--text-main)]">
                      {plan.messages_limit === -1 ? d.unlimited : plan.messages_limit.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[var(--text-dim)]">{d.voiceMinutesLimit}</span>
                    <span className="font-bold font-mono text-[var(--text-main)]">
                      {plan.voice_minutes_limit === -1 ? d.unlimited : `${plan.voice_minutes_limit} ${d.minutes}`}
                    </span>
                  </div>

                  {/* Guaranteed commission_rate fetched from database via RPC */}
                  <div className="flex justify-between items-center border-t border-[var(--glass-border)] pt-2 text-xs">
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

              <div className="h-px w-full bg-[var(--glass-border)] my-4" />

              {/* VIP Notice */}
              {isVIP && (
                <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-start gap-3">
                  <Key className="text-purple-400 shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-purple-300/90 leading-relaxed">
                    {d.vipNotice}
                  </p>
                </div>
              )}

              {/* Feature Flags */}
              <div className="mt-2">
                <h4 className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-2">
                  صلاحيات الباقة (Feature Flags)
                </h4>
                {renderFeatures(plan.features || [], plan.slug)}
              </div>

            </div>
          )
        })}
      </div>

      {filteredPlans.length === 0 && (
        <div className="text-center py-20 text-[var(--text-dim)] border border-dashed border-[var(--glass-border)] rounded-2xl">
          <Shield size={48} className="mx-auto mb-4 opacity-50 text-purple-500" />
          <p className="text-sm font-medium">{d.noPlans}</p>
        </div>
      )}

      {/* Plan Usage Warning Modal */}
      {isArchiveModalOpen && archivingPlan && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[var(--bg-space-surface)] border border-[var(--glass-border)] rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6 relative" dir={isRTL ? 'rtl' : 'ltr'}>
            
            {/* Title */}
            <div className="flex items-center gap-3 border-b border-[var(--glass-border)] pb-4">
              <div className="p-3 bg-yellow-500/10 rounded-2xl text-yellow-400">
                <Archive size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-[var(--text-main)]">{d.archiveWarningTitle}</h3>
                <p className="text-sm text-yellow-400 font-bold mt-1 uppercase tracking-wide">{archivingPlan.name}</p>
              </div>
            </div>

            {/* Warning Message */}
            <p className="text-[var(--text-dim)] text-sm leading-relaxed">
              {d.confirmArchive}
            </p>

            {/* Statistics */}
            {usageData ? (
              <div className="bg-[var(--bg-input)] border border-[var(--glass-border)] p-5 rounded-2xl space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-dim)] text-sm">{d.agenciesCountLabel}</span>
                  <span className="text-lg font-black text-[var(--text-main)] font-mono">{usageData.agencies_count}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-dim)] text-sm">{d.clientsCountLabel}</span>
                  <span className="text-lg font-black text-[var(--text-main)] font-mono">{usageData.tenants_count}</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-6">
                <Loader2 className="animate-spin text-purple-500" size={32} />
              </div>
            )}

            {/* Info notice */}
            <div className="bg-purple-500/5 border border-purple-500/10 p-4 rounded-xl text-xs text-purple-300/80 leading-relaxed">
              {d.archiveWarningText}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-4 border-t border-[var(--glass-border)]">
              <button
                type="button"
                onClick={() => {
                  setIsArchiveModalOpen(false)
                  setArchivingPlan(null)
                  setUsageData(null)
                }}
                disabled={archivingInProgress}
                className="px-5 py-2.5 bg-[var(--bg-input)] hover:bg-[var(--hover-bg)] text-[var(--text-main)] border border-[var(--glass-border)] rounded-xl text-sm font-semibold transition-colors"
              >
                {d.cancelButton}
              </button>
              <button
                type="button"
                onClick={confirmArchivePlan}
                disabled={archivingInProgress || !usageData}
                className="px-6 py-2.5 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg transition-colors"
              >
                {archivingInProgress && <Loader2 size={14} className="animate-spin" />}
                {d.confirmButton}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
