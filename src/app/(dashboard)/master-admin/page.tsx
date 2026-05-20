'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, 
  Building2, 
  CreditCard, 
  Activity, 
  Plus, 
  Search, 
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Zap,
  Lock,
  MessageCircle,
  Power,
  PowerOff,
  Briefcase
} from 'lucide-react';

import { 
  fetchSuperAdminData, 
  toggleTenantStatusAction, 
  saveAgencyPricingAction 
} from './actions';

const SUPER_ADMIN_EMAILS = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

const SuperAdminDashboard = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalAgencies: 0,
    totalTenants: 0,
    activeSubscriptions: 0,
    totalBookings: 0,
    systemHealth: '100%'
  });
  const [agencyPricing, setAgencyPricing] = useState({
    baseFee: 100,
    percentage: 20
  });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  const checkAdminAndFetch = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      
      const userEmail = (session.user.email || '').toLowerCase();
      const superAdminEmails = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || '')
        .replace(/[^\x20-\x7E]/g, '')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);
        
      if (!superAdminEmails.includes(userEmail)) {
        setIsAdmin(false);
        setLoading(false);
        return; // Not authorized
      }
      setIsAdmin(true);
      await fetchData(session.access_token);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const fetchData = async (token: string) => {
    try {
      const response = await fetchSuperAdminData(token);
      
      if (!response.success) {
         setIsAdmin(false);
         return;
      }

      const { adminTenantsData, agenciesData, messagesData, platformSettings } = response;

      if (platformSettings) {
        setAgencyPricing({
          baseFee: platformSettings.agency_base_fee || 100,
          percentage: platformSettings.agency_percentage || 20
        });
      }

      setAgencies(agenciesData || []);
      
      let totalUsage = 0;
      const tenantsWithUsage = adminTenantsData?.map((t: any) => {
        const usage = messagesData?.filter((m: any) => m.tenant_id === t.id && m.sender === 'model').length || 0;
        totalUsage += usage;
        return { ...t, ai_usage: usage };
      }) || [];

      setTenants(tenantsWithUsage);
      setStats({
        totalAgencies: agenciesData?.length || 0,
        totalTenants: adminTenantsData?.length || 0,
        activeSubscriptions: adminTenantsData?.filter((t: any) => t.status === 'active').length || 0,
        totalBookings: totalUsage, // using AI usage as a metric here
        systemHealth: '100%'
      });

    } catch (e) {
      console.error(e);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAgencyPricing = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      await saveAgencyPricingAction(session.access_token, agencyPricing.baseFee, agencyPricing.percentage);
      alert('تم حفظ الإعدادات بنجاح!');
    } catch (err) {
      alert('حدث خطأ أثناء الحفظ.');
    }
  };

  const toggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const newStatus = await toggleTenantStatusAction(session.access_token, tenantId, currentStatus, session.user.id);
      setTenants(tenants.map(t => t.id === tenantId ? { ...t, status: newStatus } : t));
    } catch (e) {
      console.error('Toggle status error', e);
      alert('حدث خطأ أثناء تغيير الحالة');
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>جاري التحميل...</div>;

  if (!isAdmin) {
    return (
      <div style={{ padding: '5rem 2rem', textAlign: 'center', color: 'var(--text-main)' }}>
        <Lock size={64} color="#ef4444" style={{ margin: '0 auto 1rem auto' }} />
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>غير مصرح لك بالدخول</h1>
        <p style={{ color: 'var(--text-dim)' }}>هذه الصفحة مخصصة للإدارة العليا فقط.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', color: 'var(--text-main)' }}>
      {/* Header section with Stats */}
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '0.5rem', background: 'linear-gradient(to right, #fff, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Master Admin Control Panel
        </h1>
        <p style={{ color: 'var(--text-dim)' }}>إدارة المنصة الشاملة ومتابعة الـ 1000 عيادة والمطاعم.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        {[
          { label: 'إجمالي الوكالات', value: stats.totalAgencies, icon: Briefcase, color: '#f59e0b' },
          { label: 'إجمالي المشتركين (End Clients)', value: stats.totalTenants, icon: Building2, color: '#6366f1' },
          { label: 'اشتراكات نشطة', value: stats.activeSubscriptions, icon: ShieldCheck, color: '#10b981' },
          { label: 'عمليات الـ AI الكلية', value: stats.totalBookings, icon: Activity, color: '#a855f7' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--glass-border)', backdropFilter: 'blur(10px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <s.icon color={s.color} size={24} />
              <div style={{ fontSize: '0.7rem', background: `${s.color}20`, color: s.color, padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: '700' }}>LIVE</div>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '0.2rem' }}>{s.value}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div style={{ background: 'var(--card-bg)', borderRadius: '28px', border: '1px solid var(--glass-border)', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2>إدارة العيادات والمطاعم</h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.6rem 1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <Search size={18} color="var(--text-dim)" />
              <input type="text" placeholder="بحث عن عيادة..." style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', fontSize: '0.9rem' }} />
            </div>
            <button style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Plus size={18} /> إضافة عميل يدوي
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)', fontSize: '0.9rem' }}>
                <th style={{ textAlign: 'right', padding: '1rem' }}>المؤسسة</th>
                <th style={{ textAlign: 'right', padding: '1rem' }}>النوع</th>
                <th style={{ textAlign: 'center', padding: '1rem' }}>استهلاك الـ AI</th>
                <th style={{ textAlign: 'right', padding: '1rem' }}>الحالة</th>
                <th style={{ textAlign: 'right', padding: '1rem' }}>انتهاء الـ Trial</th>
                <th style={{ textAlign: 'center', padding: '1rem' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: '0.2s' }}>
                  <td style={{ padding: '1.2rem' }}>
                    <div style={{ fontWeight: '600' }}>{t.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      {t.agency ? `وكالة: ${t.agency.name}` : 'عميل مباشر (Direct)'}
                    </div>
                  </td>
                  <td style={{ padding: '1.2rem' }}>
                    <span style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
                      {t.type === 'clinic' ? '🏥 عيادة' : 
                       t.type === 'real_estate' ? '🏢 عقارات' :
                       t.type === 'salon' ? '✂️ صالون' :
                       t.type === 'car_rental' ? '🚗 سيارات' :
                       t.type === 'ecommerce' ? '🛍️ متجر' :
                       '🍔 مطعم/كافيه'}
                    </span>
                  </td>
                  <td style={{ padding: '1.2rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '0.4rem 0.8rem', borderRadius: '12px', fontWeight: 'bold' }}>
                      <MessageCircle size={16} /> {t.ai_usage || 0}
                    </div>
                  </td>
                  <td style={{ padding: '1.2rem' }}>
                    <span style={{ 
                      fontSize: '0.8rem', 
                      padding: '0.3rem 0.7rem', 
                      borderRadius: '8px', 
                      background: t.status === 'suspended' ? '#ef444420' : '#10b98120',
                      color: t.status === 'suspended' ? '#ef4444' : '#10b981',
                      fontWeight: '700'
                    }}>
                      {t.status === 'suspended' ? 'متوقف' : 'نشط'}
                    </span>
                  </td>
                  <td style={{ padding: '1.2rem', fontSize: '0.85rem' }}>{t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleDateString('ar-EG') : 'غير محدد'}</td>
                  <td style={{ padding: '1.2rem', textAlign: 'center', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button 
                      onClick={() => toggleTenantStatus(t.id, t.status)}
                      style={{ background: t.status === 'suspended' ? '#10b981' : '#ef4444', border: 'none', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}
                    >
                      {t.status === 'suspended' ? <Power size={14} /> : <PowerOff size={14} />}
                      {t.status === 'suspended' ? 'تفعيل' : 'إيقاف'}
                    </button>
                    <button style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                      <ExternalLink size={14} /> دخول
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agency Pricing Settings */}
      <div style={{ background: 'var(--card-bg)', borderRadius: '28px', border: '1px solid var(--glass-border)', padding: '2rem', marginTop: '3rem' }}>
        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CreditCard color="var(--accent-primary)" /> إعدادات أرباح المنصة من الوكالات (Agency Billing)
        </h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: '2rem' }}>حدد كيف سيقوم النظام بمحاسبة الوكالات وسحب أرباحك منهم تلقائياً كل شهر.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>الاشتراك الشهري الثابت للوكالة (Base Fee)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="number" 
                value={agencyPricing.baseFee}
                onChange={(e) => setAgencyPricing({...agencyPricing, baseFee: parseInt(e.target.value) || 0})}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: 'bold' }} 
              />
              <span style={{ fontSize: '1.2rem', color: 'var(--text-dim)' }}>$</span>
            </div>
            <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-dim)' }}>يتم سحبه شهرياً كرسوم ترخيص (White-label).</small>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>نسبتك من مبيعات الوكالة (Percentage)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="number" 
                value={agencyPricing.percentage}
                onChange={(e) => setAgencyPricing({...agencyPricing, percentage: parseInt(e.target.value) || 0})}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', color: '#10b981', fontSize: '1.2rem', fontWeight: 'bold' }} 
              />
              <span style={{ fontSize: '1.2rem', color: 'var(--text-dim)' }}>%</span>
            </div>
            <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-dim)' }}>النسبة التي سيتم استقطاعها من إجمالي مبيعات الوكالة.</small>
          </div>
        </div>

        <button onClick={handleSaveAgencyPricing} style={{ marginTop: '2rem', background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '0.8rem 2rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
          حفظ تسعيرة الوكالات
        </button>
      </div>

    </div>
  );
};

export default SuperAdminDashboard;
