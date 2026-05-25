'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  Loader2, 
  Plus, 
  Search, 
  ExternalLink, 
  Briefcase, 
  CheckCircle, 
  XCircle, 
  Users, 
  MessageSquare,
  DollarSign,
  Percent,
  TrendingUp,
  Building2,
  Calendar,
  Phone,
  Mail,
  ShieldCheck,
  ShieldX
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { createAgencyAction } from '@/app/(dashboard)/master-admin/agencies/actions';
import { useLanguage } from '@/context/LanguageContext';

interface AgenciesUIProps {
  initialAgencies: any[];
  plans?: any[];
  adminId?: string;
}

const d = {
  ar: {
    dir: 'rtl' as const,
    title: 'إدارة الوكالات (Agencies)',
    subtitle: 'إدارة شركاء المنصة وعمولاتهم وتراخيص التشغيل.',
    searchPlaceholder: 'بحث عن وكالة باسمها...',
    addAgency: 'إضافة وكالة جديدة',
    newAgencyTitle: 'تفاصيل الوكالة الجديدة',
    agencyName: 'اسم الوكالة',
    responsibleEmail: 'بريد المسؤول الإلكتروني',
    responsiblePhone: 'رقم مسؤول الواتساب',
    commissionRate: 'نسبة العمولة من الإيراد %',
    planType: 'باقة المنصة الممنوحة',
    save: 'حفظ وإرسال التفعيل',
    cancel: 'إلغاء',
    totalAgencies: 'إجمالي الوكالات',
    activeAgencies: 'الوكالات النشطة',
    suspendedAgencies: 'الوكالات الموقوفة',
    totalCommissions: 'إجمالي العمولات الموزعة',
    nameCol: 'الوكالة والمسؤول',
    clientsCol: 'العملاء المستضافين',
    revenueCol: 'الإيراد الشهري للوكالة',
    rateCol: 'العمولة %',
    commCol: 'العمولة المستحقة',
    statusCol: 'حالة الترخيص',
    actionsCol: 'تغيير الحالة',
    detailsCol: 'الملف الكامل',
    suspendBtn: 'تعطيل الوكالة',
    activateBtn: 'تفعيل الوكالة',
    noAgencies: 'لا توجد وكالات مسجلة حالياً',
    successAdd: 'تم إنشاء الوكالة بنجاح وإرسال رابط التفعيل وتعيين كلمة المرور.',
    errorAdd: 'خطأ أثناء تسجيل الوكالة: ',
    confirmSuspend: 'هل أنت متأكد من تعطيل حساب هذه الوكالة بالكامل ووقف وصول عملائها؟',
    confirmActivate: 'هل أنت متأكد من إعادة تفعيل ترخيص هذه الوكالة بالكامل؟',
    statusActive: 'نشطة 🟢',
    statusSuspended: 'موقوفة 🔴',
    statusInactive: 'غير محددة ⚪',
    statusWarning: 'أيام قليلة وينتهي 🟡',
    modalTitle: 'ملف الوكالة الكامل والتراخيص',
    joinedDate: 'تاريخ التسجيل بالمنصة',
    endDate: 'تاريخ انتهاء الترخيص الحالي',
    messagesUsed: 'الرسائل المستهلكة / الحد الأقصى',
    loading: 'جاري التحديث المباشر للشبكة...',
    whatsapp: 'الواتساب المسؤول',
    plan: 'باقة الوكالة الحالية',
    close: 'إغلاق النافذة'
  },
  en: {
    dir: 'ltr' as const,
    title: 'Agencies Management',
    subtitle: 'Manage platform resellers, licensing models and commission rates.',
    searchPlaceholder: 'Search agency by name...',
    addAgency: 'Add New Agency',
    newAgencyTitle: 'New Agency Profile Details',
    agencyName: 'Agency Corporate Name',
    responsibleEmail: 'Responsible Officer Email',
    responsiblePhone: 'Responsible WhatsApp Line',
    commissionRate: 'Revenue Share Commission %',
    planType: 'Assigned Platform License',
    save: 'Save and Send Activation',
    cancel: 'Cancel',
    totalAgencies: 'Total Registered Agencies',
    activeAgencies: 'Active Licenses',
    suspendedAgencies: 'Suspended Licenses',
    totalCommissions: 'Total Distributed Commissions',
    nameCol: 'Agency & Officer Info',
    clientsCol: 'Hosted Clients',
    revenueCol: 'Monthly Business Volume',
    rateCol: 'Commission %',
    commCol: 'Earned Commission',
    statusCol: 'Licensing Status',
    actionsCol: 'Licensing Action',
    detailsCol: 'Full Profile',
    suspendBtn: 'Suspend License',
    activateBtn: 'Activate License',
    noAgencies: 'No registered agencies found inside the database',
    successAdd: 'Agency corporate profile successfully initialized. Welcome email dispatched.',
    errorAdd: 'Error compiling agency registry: ',
    confirmSuspend: 'Are you absolutely sure you want to suspend this agency? This blocks client routing.',
    confirmActivate: 'Are you sure you want to restore full operational state to this reseller?',
    statusActive: 'Active 🟢',
    statusSuspended: 'Suspended 🔴',
    statusInactive: 'Unassigned ⚪',
    statusWarning: 'Expiring Soon 🟡',
    modalTitle: 'Reseller Full Operational File',
    joinedDate: 'Initial Platform Integration Date',
    endDate: 'Current License Expiry Date',
    messagesUsed: 'Consumed API Messages / Cap',
    loading: 'Updating cloud networks...',
    whatsapp: 'Responsible WhatsApp',
    plan: 'Reseller License Model',
    close: 'Close Window'
  },
  fr: {
    dir: 'ltr' as const,
    title: 'Gestion des Agences',
    subtitle: 'Gérer les revendeurs de la plateforme, leurs licences et taux de commission.',
    searchPlaceholder: 'Rechercher une agence...',
    addAgency: 'Nouvelle Agence',
    newAgencyTitle: "Fiche d'Inscription Agence",
    agencyName: "Raison Sociale de l'Agence",
    responsibleEmail: 'Email du Mandataire Responsable',
    responsiblePhone: 'Téléphone WhatsApp Responsable',
    commissionRate: 'Taux de Partage des Revenus %',
    planType: 'Licence de Plateforme Attribuée',
    save: 'Enregistrer et Activer',
    cancel: 'Annuler',
    totalAgencies: 'Total des Agences',
    activeAgencies: 'Licences Actives',
    suspendedAgencies: 'Licences Suspendues',
    totalCommissions: 'Commissions Distribuées',
    nameCol: 'Agence & Contact',
    clientsCol: 'Clients Hébergés',
    revenueCol: "Volume d'Affaires Mensuel",
    rateCol: 'Commission %',
    commCol: 'Commission Gagnée',
    statusCol: 'Statut de Licence',
    actionsCol: 'Action de Licence',
    detailsCol: 'Fiche Complète',
    suspendBtn: 'Suspendre la Licence',
    activateBtn: 'Activer la Licence',
    noAgencies: 'Aucune agence trouvée dans la base de données',
    successAdd: 'Profil de revendeur configuré avec succès. E-mail de bienvenue envoyé.',
    errorAdd: "Erreur lors de l'enregistrement de l'agence: ",
    confirmSuspend: 'Êtes-vous sûr de vouloir suspendre cette agence et couper ses clients?',
    confirmActivate: 'Êtes-vous sûr de vouloir restaurer les droits de cette agence?',
    statusActive: 'Active 🟢',
    statusSuspended: 'Suspendue 🔴',
    statusInactive: 'Non Assignée ⚪',
    statusWarning: 'Expire Bientôt 🟡',
    modalTitle: 'Dossier Opérationnel Complet',
    joinedDate: "Date d'Adhésion Initiale",
    endDate: 'Date Expiration de la Licence',
    messagesUsed: 'Messages API Consommés / Cap',
    loading: 'Mise à jour du cloud...',
    whatsapp: 'WhatsApp Mandataire',
    plan: 'Modèle de Licence Revendeur',
    close: 'Fermer la Fenêtre'
  }
};

export function AgenciesUI({ initialAgencies, plans = [], adminId }: AgenciesUIProps) {
  const supabase = createClientComponentClient();
  const { language } = useLanguage();
  const currentLang = (language as 'ar' | 'en' | 'fr') || 'ar';
  const t = d[currentLang];

  const [agencies, setAgencies] = useState<any[]>(initialAgencies);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<any | null>(null);
  
  const [newAgency, setNewAgency] = useState({
    name: '',
    email: '',
    whatsapp: '',
    commission_rate: 20,
    plan_slug: plans.length > 0 ? plans[0].slug : 'starter'
  });

  useEffect(() => {
    if (plans.length > 0 && !newAgency.plan_slug) {
      setNewAgency(prev => ({ ...prev, plan_slug: plans[0].slug }));
    }
  }, [plans]);

  const fetchAgencies = async () => {
    setLoading(true);
    try {
      const { data: agenciesData } = await supabase
        .from('agencies')
        .select(`
          *,
          tenants (id)
        `)
        .order('created_at', { ascending: false });

      setAgencies(agenciesData || []);
    } catch (error) {
      console.error('Failed to fetch agencies client-side:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAgency = async () => {
    if (!newAgency.name || !newAgency.email) return;
    
    setLoading(true);
    try {
      let activeAdminId = adminId;
      if (!activeAdminId) {
        const { data: { session } } = await supabase.auth.getSession();
        activeAdminId = session?.user?.id;
      }

      if (!activeAdminId) {
        alert("Session expired. Please log in again.");
        return;
      }
      
      const createdAgency = await createAgencyAction(newAgency, activeAdminId);
      
      alert(t.successAdd);
      setShowAddForm(false);
      
      // Update local state instantly (double-protection for immediate render)
      if (createdAgency) {
        setAgencies(prev => [
          {
            ...createdAgency,
            tenants: [] // default empty tenants array to match the query interface
          },
          ...prev
        ]);
      }

      setNewAgency({
        name: '',
        email: '',
        whatsapp: '',
        commission_rate: 20,
        plan_slug: plans.length > 0 ? plans[0].slug : 'starter'
      });
      await fetchAgencies();
    } catch (e: any) {
      console.error(e);
      alert(t.errorAdd + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (agencyId: string, currentStatus: string) => {
    const isSuspended = currentStatus === 'suspended';
    const actionType = isSuspended ? 'activate' : 'suspend';
    const messageConfirm = isSuspended ? t.confirmActivate : t.confirmSuspend;
    if (!confirm(messageConfirm)) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/agencies/${actionType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyId })
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (res.ok) {
        await fetchAgencies();
      } else {
        alert('Error: ' + (data.error || 'Unknown error') + ' (Status: ' + res.status + ')');
      }
    } catch (e: any) {
      console.error(e);
      alert('Network Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredAgencies = agencies.filter(a => 
    a.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.contact_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Cards calculations
  const totalAgencies = agencies.length;
  const activeAgencies = agencies.filter(a => a.subscription_status === 'active' || !a.subscription_status).length;
  const suspendedAgencies = agencies.filter(a => a.subscription_status === 'suspended').length;
  const totalCommissions = agencies.reduce((sum, a) => {
    const revenue = a.revenue || 0;
    const rate = a.commission_rate || 20;
    return sum + ((revenue * rate) / 100);
  }, 0);

  const getStatusBadge = (a: any) => {
    const now = new Date();
    const end = a.subscription_end_date ? new Date(a.subscription_end_date) : null;
    
    let color = '#10b981';
    let text = t.statusActive;
    
    if (a.subscription_status === 'suspended') {
      color = '#ef4444';
      text = t.statusSuspended;
    } else if (!end) {
      color = '#9ca3af';
      text = t.statusInactive;
    } else if (end < now) {
      color = '#ef4444';
      text = t.statusSuspended;
    } else {
      const diffTime = Math.abs(end.getTime() - now.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        color = '#f59e0b';
        text = t.statusWarning;
      }
    }

    return { color, text };
  };

  return (
    <div dir={t.dir} style={{ padding: '2rem', color: 'var(--text-main)' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, background: 'linear-gradient(135deg, #a78bfa, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.03em' }}>{t.title}</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '1.1rem', marginTop: '0.25rem' }}>{t.subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.75rem', background: 'var(--card-bg)', padding: '0.75rem 1.25rem', borderRadius: '16px', border: '1px solid var(--glass-border)', alignItems: 'center', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)' }}>
            <Search size={18} color="var(--text-dim)" />
            <input 
              type="text" 
              placeholder={t.searchPlaceholder} 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', width: '220px', fontSize: '0.95rem' }} 
            />
          </div>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: 'white', border: 'none', padding: '0.75rem 1.75rem', borderRadius: '16px', fontWeight: 700, cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center', transition: 'all 0.3s ease', boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)' }}
          >
            <Plus size={18} /> {t.addAgency}
          </button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', boxShadow: '0 8px 32px 0 rgba(0,0,0,0.15)', backdropFilter: 'blur(12px)' }}>
          <div style={{ background: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.2)', borderRadius: '18px', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Briefcase size={28} color="#a78bfa" />
          </div>
          <div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', fontWeight: 500 }}>{t.totalAgencies}</div>
            <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: '0.2rem', color: '#f8fafc' }}>{totalAgencies}</div>
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', boxShadow: '0 8px 32px 0 rgba(0,0,0,0.15)', backdropFilter: 'blur(12px)' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '18px', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={28} color="#10b981" />
          </div>
          <div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', fontWeight: 500 }}>{t.activeAgencies}</div>
            <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: '0.2rem', color: '#10b981' }}>{activeAgencies}</div>
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', boxShadow: '0 8px 32px 0 rgba(0,0,0,0.15)', backdropFilter: 'blur(12px)' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '18px', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <XCircle size={28} color="#ef4444" />
          </div>
          <div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', fontWeight: 500 }}>{t.suspendedAgencies}</div>
            <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: '0.2rem', color: '#ef4444' }}>{suspendedAgencies}</div>
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', boxShadow: '0 8px 32px 0 rgba(0,0,0,0.15)', backdropFilter: 'blur(12px)' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '18px', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={28} color="#6366f1" />
          </div>
          <div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', fontWeight: 500 }}>{t.totalCommissions}</div>
            <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: '0.2rem', color: '#6366f1' }}>${totalCommissions.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* ADD AGENCY FORM */}
      {showAddForm && (
        <div style={{ background: 'var(--card-bg)', padding: '2.5rem', borderRadius: '32px', border: '1px solid var(--glass-border)', marginBottom: '2.5rem', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', backdropFilter: 'blur(20px)' }}>
          <h3 style={{ marginBottom: '2rem', fontSize: '1.35rem', fontWeight: 800, borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.8rem', color: '#f8fafc' }}>{t.newAgencyTitle}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t.agencyName}</label>
              <input placeholder={t.agencyName} value={newAgency.name} onChange={e => setNewAgency({...newAgency, name: e.target.value})} style={{ padding: '0.9rem 1.2rem', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t.responsibleEmail}</label>
              <input placeholder={t.responsibleEmail} type="email" value={newAgency.email} onChange={e => setNewAgency({...newAgency, email: e.target.value})} style={{ padding: '0.9rem 1.2rem', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t.responsiblePhone}</label>
              <input placeholder={t.responsiblePhone} type="tel" value={newAgency.whatsapp} onChange={e => setNewAgency({...newAgency, whatsapp: e.target.value})} style={{ padding: '0.9rem 1.2rem', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t.commissionRate}</label>
              <input placeholder={t.commissionRate} type="number" min="0" max="50" value={newAgency.commission_rate} onChange={e => setNewAgency({...newAgency, commission_rate: parseInt(e.target.value) || 0})} style={{ padding: '0.9rem 1.2rem', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t.planType}</label>
              <select value={newAgency.plan_slug} onChange={e => setNewAgency({...newAgency, plan_slug: e.target.value})} style={{ padding: '0.9rem 1.2rem', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none', cursor: 'pointer' }}>
                {plans
                  .filter(p => p.intended_for === 'agency' || p.intended_for === 'both')
                  .map(p => (
                    <option key={p.id} value={p.slug} style={{ background: '#0f172a', color: '#f8fafc' }}>
                      {p.name} - ${p.price_monthly}/mo
                    </option>
                  ))
                }
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button onClick={handleAddAgency} disabled={loading} style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: 'white', border: 'none', padding: '0.75rem 2.5rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem', transition: 'all 0.3s' }}>{t.save}</button>
            <button onClick={() => setShowAddForm(false)} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '0.75rem 2.5rem', borderRadius: '12px', cursor: 'pointer', fontSize: '0.95rem' }}>{t.cancel}</button>
          </div>
        </div>
      )}

      {/* AGENCIES TABLE */}
      <div style={{ background: 'var(--card-bg)', borderRadius: '32px', border: '1px solid var(--glass-border)', padding: '1.5rem', overflowX: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.2)', backdropFilter: 'blur(12px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: t.dir === 'rtl' ? 'right' : 'left' }}>
          <thead>
            <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)', fontSize: '0.95rem' }}>
              <th style={{ padding: '1.2rem 1rem' }}>{t.nameCol}</th>
              <th style={{ padding: '1.2rem 1rem' }}>{t.clientsCol}</th>
              <th style={{ padding: '1.2rem 1rem' }}>{t.revenueCol}</th>
              <th style={{ padding: '1.2rem 1rem' }}>{t.rateCol}</th>
              <th style={{ padding: '1.2rem 1rem' }}>{t.commCol}</th>
              <th style={{ padding: '1.2rem 1rem' }}>{t.statusCol}</th>
              <th style={{ padding: '1.2rem 1rem' }}>{t.actionsCol}</th>
              <th style={{ padding: '1.2rem 1rem', textAlign: 'center' }}>{t.detailsCol}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 0 }}><TableSkeleton columns={8} rows={5} /></td></tr>
            ) : filteredAgencies.map((a, i) => {
              const revenue = a.revenue || 0;
              const rate = a.commission_rate || 20;
              const commission = (revenue * rate) / 100;
              const { color: statusColor, text: statusText } = getStatusBadge(a);
              const isActive = a.subscription_status === 'active' || !a.subscription_status;

              return (
                <tr key={a.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.2s', alignSelf: 'center' }}>
                  <td style={{ padding: '1.2rem 1rem', fontWeight: 600 }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.75rem', borderRadius: '14px', display: 'flex', alignItems: 'center' }}>
                        <Briefcase size={20} color="#8b5cf6" /> 
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontSize: '1.05rem', color: '#f8fafc' }}>{a.name}</span>
                        {a.contact_email && <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 400 }}>{a.contact_email}</span>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1.2rem 1rem', fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc' }}>{a.tenants?.length || 0}</td>
                  <td style={{ padding: '1.2rem 1rem', fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc' }}>${revenue.toLocaleString()}</td>
                  <td style={{ padding: '1.2rem 1rem', color: '#10b981', fontWeight: 700, fontSize: '1.05rem' }}>{rate}%</td>
                  <td style={{ padding: '1.2rem 1rem', color: '#8b5cf6', fontWeight: 800, fontSize: '1.1rem' }}>${commission.toLocaleString()}</td>
                  <td style={{ padding: '1.2rem 1rem' }}>
                    <span style={{ background: `${statusColor}15`, color: statusColor, padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, border: `1px solid ${statusColor}25` }}>
                      {statusText}
                    </span>
                  </td>
                  <td style={{ padding: '1.2rem 1rem' }}>
                    <button 
                      onClick={() => handleToggleStatus(a.id, a.subscription_status)}
                      style={{ 
                        background: isActive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                        color: isActive ? '#ef4444' : '#10b981', 
                        border: isActive ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
                        padding: '0.45rem 1rem', 
                        borderRadius: '10px', 
                        cursor: 'pointer', 
                        fontSize: '0.85rem', 
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isActive ? (
                        <>
                          <ShieldX size={14} /> {t.suspendBtn}
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={14} /> {t.activateBtn}
                        </>
                      )}
                    </button>
                  </td>
                  <td style={{ padding: '1.2rem 1rem', textAlign: 'center' }}>
                    <button 
                      onClick={() => setSelectedAgency(a)}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '0.45rem 1rem', borderRadius: '10px', cursor: 'pointer', display: 'flex', gap: '0.4rem', alignItems: 'center', margin: 'auto', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s' }}
                    >
                      <ExternalLink size={14} /> {t.detailsCol}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!loading && filteredAgencies.length === 0 && (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
            <Briefcase size={40} color="var(--text-dim)" />
            <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{t.noAgencies}</span>
          </div>
        )}
      </div>

      {/* FULL DETAILS MODAL */}
      {selectedAgency && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1.5rem', backdropFilter: 'blur(16px)', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ background: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '32px', width: '100%', maxWidth: '650px', padding: '2.5rem', color: '#f8fafc', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', position: 'relative' }} dir={t.dir}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '1rem', borderRadius: '20px', display: 'flex', alignItems: 'center' }}>
                <Briefcase size={32} color="#8b5cf6" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 900 }}>{selectedAgency.name}</h3>
                <span style={{ fontSize: '0.9rem', color: '#a78bfa', fontWeight: 600 }}>{t.modalTitle}</span>
              </div>
            </div>

            {/* Modal Body Info Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <Mail size={18} color="var(--text-dim)" />
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{t.responsibleEmail}</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{selectedAgency.contact_email || '—'}</div>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <Phone size={18} color="var(--text-dim)" />
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{t.whatsapp}</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{selectedAgency.whatsapp_number || '—'}</div>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <Building2 size={18} color="var(--text-dim)" />
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{t.plan}</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#8b5cf6' }}>{selectedAgency.plan_type ? selectedAgency.plan_type.toUpperCase() : '—'}</div>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <Percent size={18} color="var(--text-dim)" />
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{t.rateCol}</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#10b981' }}>{selectedAgency.commission_rate || 20}%</div>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <Users size={18} color="var(--text-dim)" />
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{t.clientsCol}</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{selectedAgency.tenants?.length || 0}</div>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <MessageSquare size={18} color="var(--text-dim)" />
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{t.messagesUsed}</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{selectedAgency.messages_used || 0} / {selectedAgency.messages_limit === -1 ? '∞' : (selectedAgency.messages_limit || '—')}</div>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <Calendar size={18} color="var(--text-dim)" />
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{t.joinedDate}</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{selectedAgency.created_at ? new Date(selectedAgency.created_at).toLocaleDateString() : '—'}</div>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <Calendar size={18} color="var(--text-dim)" />
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{t.endDate}</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{selectedAgency.subscription_end_date ? new Date(selectedAgency.subscription_end_date).toLocaleDateString() : '—'}</div>
                </div>
              </div>

            </div>

            {/* Modal Footer Controls */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.5rem' }}>
              <button 
                onClick={() => setSelectedAgency(null)}
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#ffffff', border: 'none', padding: '0.75rem 2.5rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem', transition: 'all 0.2s', boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)' }}
              >
                {t.close}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Global CSS for Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

    </div>
  );
}
