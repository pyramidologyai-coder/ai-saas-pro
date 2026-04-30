'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Building2, MessageCircle, Link as LinkIcon, Plus, ExternalLink, Settings, ShieldCheck, UserPlus } from 'lucide-react';

export default function AgencyDashboard() {
  const [agency, setAgency] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalTenants: 0, totalAiUsage: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsData, setSettingsData] = useState({
    stripe_account_id: '',
    paymob_api_key: '',
    custom_domain: ''
  });

  useEffect(() => {
    fetchAgencyData();
  }, []);

  const fetchAgencyData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      // 1. Get Agency Profile
      const { data: agencyData, error } = await supabase
        .from('agencies')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      // SECURITY: If RLS blocks or not an agency, reject
      if (error || !agencyData) {
        setLoading(false);
        setAgency(null);
        return; // User is not an agency
      }
      setAgency(agencyData);
      setSettingsData({
        stripe_account_id: agencyData.stripe_account_id || '',
        paymob_api_key: agencyData.paymob_api_key || '',
        custom_domain: agencyData.custom_domain || ''
      });

      // 2. Get Agency's Tenants
      const { data: tenantsData } = await supabase
        .from('tenants')
        .select('*')
        .eq('agency_id', agencyData.id);

      // 3. Get AI Usage for these tenants
      const tenantIds = tenantsData?.map(t => t.id) || [];
      const { data: messagesData } = await supabase
        .from('messages')
        .select('tenant_id, sender')
        .in('tenant_id', tenantIds);

      let totalUsage = 0;
      const tenantsWithUsage = tenantsData?.map(t => {
        const usage = messagesData?.filter(m => m.tenant_id === t.id && m.sender === 'model').length || 0;
        totalUsage += usage;
        return { ...t, ai_usage: usage };
      }) || [];

      setTenants(tenantsWithUsage);
      setStats({
        totalTenants: tenantsData?.length || 0,
        totalAiUsage: totalUsage
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      // SECURITY: Sanitize input to prevent Agency Mass Assignment
      const { stripe_account_id, paymob_api_key, custom_domain } = settingsData as any;
      const safeData = { stripe_account_id, paymob_api_key, custom_domain };
      
      const { error } = await supabase.from('agencies').update(safeData).eq('id', agency.id);
      if (error) throw error;
      setAgency({ ...agency, ...settingsData });
      setShowSettings(false);
      alert('تم حفظ الإعدادات بنجاح!');
    } catch (err) {
      alert('حدث خطأ أثناء الحفظ.');
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    // 10000-YEAR HACKER DEFENSE: IDOR Protection (Insecure Direct Object Reference)
    // Never trust the client ID alone. Always verify the tenant belongs to the AGENCY making the request.
    const isOwner = tenants.some(t => t.id === tenantId);
    if (!isOwner) {
      alert("HACKER DETECTED: You do not own this tenant!");
      return;
    }

    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    
    // We add .eq('agency_id', agency.id) as a database-level safeguard even though RLS is active.
    await supabase.from('tenants').update({ status: newStatus }).eq('id', tenantId).eq('agency_id', agency.id);
    setTenants(tenants.map(t => t.id === tenantId ? { ...t, status: newStatus } : t));
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>جاري التحميل...</div>;

  if (!agency) {
    return (
      <div style={{ padding: '5rem 2rem', textAlign: 'center', color: 'var(--text-main)' }}>
        <ShieldCheck size={64} color="#f59e0b" style={{ margin: '0 auto 1rem auto' }} />
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>لوحة الوكالات (Agency Reseller)</h1>
        <p style={{ color: 'var(--text-dim)', marginBottom: '2rem' }}>أنت غير مسجل كصاحب وكالة. هل تريد ترقية حسابك لتبدأ في بيع النظام بالعمولة باسمك (White-label)؟</p>
        <button 
          onClick={async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            // SECURITY FIX: Status is pending_payment, not active!
            const { error } = await supabase.from('agencies').insert({
              user_id: session.user.id,
              name: 'وكالتي الإعلانية',
              subscription_status: 'pending_payment'
            });
            if (!error) {
              alert('تم تسجيل طلبك! في بيئة الإنتاج الفعلية سيتم تحويلك لصفحة الدفع.');
              window.location.reload();
            } else {
              alert('حدث خطأ. ربما لديك طلب مسبق.');
            }
          }}
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', border: 'none', padding: '0.8rem 2rem', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Building2 size={20} /> ترقية حسابي إلى وكالة الآن (499$/شهرياً)
        </button>
      </div>
    );
  }

  // SECURITY FIX: Lock Screen for Pending/Suspended Agencies
  if (agency.subscription_status !== 'active') {
    return (
      <div style={{ padding: '5rem 2rem', textAlign: 'center', color: 'var(--text-main)' }}>
        <ShieldCheck size={64} color="#ef4444" style={{ margin: '0 auto 1rem auto' }} />
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>حساب الوكالة غير مفعل</h1>
        <p style={{ color: 'var(--text-dim)', marginBottom: '2rem' }}>حساب الوكالة الخاص بك مسجل لدينا ولكنه بانتظار إتمام الدفع (أو تم إيقافه). لا يمكنك إضافة عملاء حالياً.</p>
        <button style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '0.8rem 2rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
          استكمال الدفع الآن
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', color: 'var(--text-main)' }}>
      {/* Agency Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Building2 size={36} color="var(--accent-primary)" />
            {agency.name}
          </h1>
          <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><LinkIcon size={16}/> {agency.custom_domain || 'لم يتم ربط دومين بعد'}</span>
            <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: 'bold' }}>{agency.subscription_status === 'active' ? 'وكالة نشطة' : 'متوقف'}</span>
          </div>
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '0.6rem 1.2rem', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Settings size={18} /> إعدادات الوكالة (White-label)
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <Building2 color="#6366f1" size={24} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '0.2rem' }}>{stats.totalTenants}</div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>إجمالي العملاء (العيادات/المطاعم)</div>
        </div>
        
        <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <MessageCircle color="#a855f7" size={24} />
            <div style={{ fontSize: '0.7rem', background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: '700' }}>معدل الاستهلاك</div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '0.2rem' }}>{stats.totalAiUsage} <span style={{fontSize:'1rem', color:'var(--text-dim)'}}>/ 20,000</span></div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>إجمالي رسائل الـ AI المستهلكة (لجميع عملائك)</div>
          
          {/* Progress Bar */}
          <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: '3px', marginTop: '1rem', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min((stats.totalAiUsage / 20000) * 100, 100)}%`, background: '#a855f7', height: '100%', borderRadius: '3px' }}></div>
          </div>
        </div>
      </div>

      {/* Tenants Table */}
      <div style={{ background: 'var(--card-bg)', borderRadius: '28px', border: '1px solid var(--glass-border)', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2>عملائي (My Clients)</h2>
          <Link href={`/onboarding?agency_id=${agency.id}`} style={{ textDecoration: 'none', background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <UserPlus size={18} /> إضافة عميل جديد
          </Link>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)', fontSize: '0.9rem' }}>
                <th style={{ textAlign: 'right', padding: '1rem' }}>اسم العميل</th>
                <th style={{ textAlign: 'right', padding: '1rem' }}>المجال</th>
                <th style={{ textAlign: 'center', padding: '1rem' }}>استهلاك الـ AI</th>
                <th style={{ textAlign: 'center', padding: '1rem' }}>الحالة</th>
                <th style={{ textAlign: 'right', padding: '1rem' }}>انتهاء الاشتراك</th>
                <th style={{ textAlign: 'center', padding: '1rem' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: '0.2s' }}>
                  <td style={{ padding: '1.2rem' }}>
                    <div style={{ fontWeight: '600' }}>{t.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{t.slug}.{agency.custom_domain || 'zaky.ai'}</div>
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
                    <div style={{ display: 'inline-block', background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '0.3rem 0.8rem', borderRadius: '12px', fontWeight: 'bold' }}>
                      {t.ai_usage || 0}
                    </div>
                  </td>
                  <td style={{ padding: '1.2rem', textAlign: 'center' }}>
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
                      {t.status === 'suspended' ? 'تفعيل' : 'إيقاف'}
                    </button>
                    <button style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                      <Settings size={14} /> الإعدادات
                    </button>
                    <button style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--accent-primary)', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                      <ExternalLink size={14} /> دخول
                    </button>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                    لم تقم بإضافة أي عملاء حتى الآن. ابدأ ببيع نظامك الخاص!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-color)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--glass-border)', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent-primary)' }}>إعدادات الدفع والدومين (White-label)</h2>
            <p style={{ color: 'var(--text-dim)', marginBottom: '2rem', fontSize: '0.9rem' }}>أدخل مفاتيح بوابات الدفع الخاصة بك ليتم تحصيل الاشتراكات من عملائك مباشرة إلى حسابك البنكي.</p>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>اسم الدومين المخصص (Custom Domain)</label>
              <input 
                type="text" 
                value={settingsData.custom_domain} 
                onChange={(e) => setSettingsData({...settingsData, custom_domain: e.target.value})} 
                placeholder="مثال: myagency.com"
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--card-bg)', color: 'var(--text-main)' }} 
              />
            </div>

            <h3 style={{ marginBottom: '1rem', color: '#635BFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>الدفع الدولي (Stripe Connect)</h3>
            <div style={{ marginBottom: '1rem', background: 'rgba(99, 91, 255, 0.1)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(99, 91, 255, 0.3)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '0.5rem', lineHeight: '1.5' }}>
                لتحصيل أرباحك مباشرة، يرجى ربط حسابك في Stripe (Stripe Connect Account ID). 
                نحن نقتطع عمولة التشغيل آلياً ونرسل باقي المبلغ مباشرة إلى حسابك البنكي المربوط بـ Stripe.
              </p>
            </div>
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Stripe Account ID <span style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="text" 
                value={settingsData.stripe_account_id} 
                onChange={(e) => setSettingsData({...settingsData, stripe_account_id: e.target.value})} 
                placeholder="acct_1OuXXXXX..."
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--card-bg)', color: 'var(--text-main)' }} 
              />
            </div>
            <h3 style={{ marginBottom: '1rem', color: '#0055FF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>الدفع المحلي (Paymob)</h3>
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Paymob API Key</label>
              <input 
                type="password" 
                value={settingsData.paymob_api_key} 
                onChange={(e) => setSettingsData({...settingsData, paymob_api_key: e.target.value})} 
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--card-bg)', color: 'var(--text-main)' }} 
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowSettings(false)}
                style={{ padding: '0.8rem 1.5rem', background: 'transparent', color: 'var(--text-dim)', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                إلغاء
              </button>
              <button 
                onClick={handleSaveSettings}
                disabled={savingSettings}
                style={{ padding: '0.8rem 1.5rem', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {savingSettings ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
