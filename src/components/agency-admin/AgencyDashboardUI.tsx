'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  MessageCircle, 
  Link as LinkIcon, 
  ExternalLink, 
  Settings as SettingsIcon, 
  UserPlus, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { saveAgencySettingsAction, toggleTenantStatusAction } from '@/app/(dashboard)/agency-admin/actions';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  trial_ends_at: string | null;
  ai_usage?: number;
}

interface Agency {
  id: string;
  name: string;
  custom_domain: string | null;
  subscription_status: string;
  stripe_account_id: string | null;
  paymob_api_key_encrypted: string | null;
}

interface AgencyDashboardUIProps {
  agency: Agency;
  tenants: Tenant[];
  initialStats: {
    totalTenants: number;
    totalAiUsage: number;
  };
  stripeAccountIdMasked: string;
  paymobApiKeyMasked: string;
}

export function AgencyDashboardUI({
  agency: initialAgency,
  tenants: initialTenants,
  initialStats,
  stripeAccountIdMasked,
  paymobApiKeyMasked
}: AgencyDashboardUIProps) {
  const [agency, setAgency] = useState<Agency>(initialAgency);
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [stats, setStats] = useState(initialStats);
  
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsData, setSettingsData] = useState({
    stripe_account_id: stripeAccountIdMasked,
    paymob_api_key: paymobApiKeyMasked,
    custom_domain: initialAgency.custom_domain || ''
  });

  const [showPaymobKey, setShowPaymobKey] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleSaveSettings = async () => {
    setSavingSettings(false);
    setErrorMessage(null);
    setSuccessMessage(null);
    
    // Client-side sanitization
    if (settingsData.stripe_account_id && 
        !settingsData.stripe_account_id.includes('••••') && 
        !settingsData.stripe_account_id.startsWith('acct_') &&
        settingsData.stripe_account_id !== '') {
      setErrorMessage('معرف Stripe Connect يجب أن يبدأ بـ acct_');
      return;
    }

    setSavingSettings(true);
    try {
      const result = await saveAgencySettingsAction(
        agency.id,
        settingsData.custom_domain,
        settingsData.stripe_account_id,
        settingsData.paymob_api_key
      );

      if (result.success) {
        setAgency({
          ...agency,
          custom_domain: settingsData.custom_domain,
          stripe_account_id: settingsData.stripe_account_id.includes('••••') ? agency.stripe_account_id : settingsData.stripe_account_id
        });
        setSuccessMessage('تم حفظ إعدادات الوكالة بنجاح وبشكل مشفر وآمن! 🔒');
        setTimeout(() => {
          setShowSettings(false);
          setSuccessMessage(null);
        }, 2000);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ الإعدادات.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    setTogglingId(tenantId);
    try {
      const result = await toggleTenantStatusAction(tenantId, agency.id, currentStatus);
      if (result.success) {
        setTenants(prev => 
          prev.map(t => t.id === tenantId ? { ...t, status: result.newStatus } : t)
        );
      }
    } catch (err: any) {
      alert(err.message || 'فشلت عملية التعديل.');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div style={{ padding: '2rem', color: 'var(--text-main)', direction: 'rtl' }}>
      
      {/* Agency Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Building2 size={36} color="var(--accent-primary)" />
            {agency.name}
          </h1>
          <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-dim)', fontSize: '0.9rem', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <LinkIcon size={16}/> {agency.custom_domain || 'لم يتم ربط دومين بعد'}
            </span>
            <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: 'bold' }}>
              وكالة نشطة 📦
            </span>
          </div>
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          style={{ 
            background: 'rgba(255,255,255,0.05)', 
            border: '1px solid var(--glass-border)', 
            color: 'var(--text-main)', 
            padding: '0.6rem 1.2rem', 
            borderRadius: '12px', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            transition: 'all 0.2s ease',
            fontWeight: '600'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        >
          <SettingsIcon size={18} /> إعدادات الوكالة (White-label)
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div style={{ 
          background: 'var(--card-bg)', 
          padding: '1.8rem', 
          borderRadius: '24px', 
          border: '1px solid var(--glass-border)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <Building2 color="#6366f1" size={24} />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: '800', marginBottom: '0.2rem' }}>{stats.totalTenants}</div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>إجمالي العملاء (العيادات/المطاعم)</div>
        </div>
        
        <div style={{ 
          background: 'var(--card-bg)', 
          padding: '1.8rem', 
          borderRadius: '24px', 
          border: '1px solid var(--glass-border)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <MessageCircle color="#a855f7" size={24} />
            <div style={{ fontSize: '0.75rem', background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: '700' }}>معدل الاستهلاك</div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: '800', marginBottom: '0.2rem' }}>
            {stats.totalAiUsage} <span style={{fontSize:'1.1rem', color:'var(--text-dim)'}}>/ 20,000</span>
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>إجمالي رسائل الـ AI المستهلكة (لجميع عملائك)</div>
          
          {/* Progress Bar */}
          <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', height: '8px', borderRadius: '4px', marginTop: '1rem', overflow: 'hidden' }}>
            <div style={{ 
              width: `${Math.min((stats.totalAiUsage / 20000) * 100, 100)}%`, 
              background: 'linear-gradient(90deg, #a855f7, #6366f1)', 
              height: '100%', 
              borderRadius: '4px',
              transition: 'width 0.5s ease-in-out'
            }}></div>
          </div>
        </div>
      </div>

      {/* Tenants Table */}
      <div style={{ 
        background: 'var(--card-bg)', 
        borderRadius: '28px', 
        border: '1px solid var(--glass-border)', 
        padding: '2rem',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '850' }}>عملائي المباشرين (My Clients)</h2>
          <Link 
            href={`/onboarding?agency_id=${agency.id}`} 
            style={{ 
              textDecoration: 'none', 
              background: 'var(--accent-primary)', 
              color: 'white', 
              border: 'none', 
              padding: '0.7rem 1.5rem', 
              borderRadius: '12px', 
              fontWeight: '700', 
              cursor: 'pointer', 
              display: 'flex', 
              gap: '0.5rem', 
              alignItems: 'center',
              boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <UserPlus size={18} /> إضافة عميل جديد
          </Link>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)', fontSize: '0.95rem' }}>
                <th style={{ textAlign: 'right', padding: '1rem' }}>اسم العميل</th>
                <th style={{ textAlign: 'right', padding: '1rem' }}>المجال</th>
                <th style={{ textAlign: 'center', padding: '1rem' }}>استهلاك الـ AI</th>
                <th style={{ textAlign: 'center', padding: '1rem' }}>الحالة</th>
                <th style={{ textAlign: 'right', padding: '1rem' }}>انتهاء الاشتراك</th>
                <th style={{ textAlign: 'center', padding: '1rem' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: '0.2s' }}>
                  <td style={{ padding: '1.2rem' }}>
                    <div style={{ fontWeight: '600', fontSize: '1.05rem' }}>{t.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', direction: 'ltr', textAlign: 'right' }}>
                      {t.slug}.{agency.custom_domain || 'zaky.ai'}
                    </div>
                  </td>
                  <td style={{ padding: '1.2rem' }}>
                    <span style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
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
                  <td style={{ padding: '1.2rem', fontSize: '0.85rem' }}>
                    {t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleDateString('ar-EG') : 'غير محدد'}
                  </td>
                  <td style={{ padding: '1.2rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button 
                        onClick={() => handleToggleTenantStatus(t.id, t.status)}
                        disabled={togglingId === t.id}
                        style={{ 
                          background: t.status === 'suspended' ? '#10b981' : '#ef4444', 
                          border: 'none', 
                          color: 'white', 
                          padding: '0.4rem 0.8rem', 
                          borderRadius: '8px', 
                          cursor: 'pointer', 
                          fontSize: '0.8rem', 
                          fontWeight: 'bold',
                          opacity: togglingId === t.id ? 0.6 : 1,
                          minWidth: '70px'
                        }}
                      >
                        {togglingId === t.id ? 'جاري...' : (t.status === 'suspended' ? 'تفعيل' : 'إيقاف')}
                      </button>
                      <button style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                        <SettingsIcon size={14} /> الإعدادات
                      </button>
                      <button style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--accent-primary)', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                        <ExternalLink size={14} /> دخول
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                    لم تقم بإضافة أي عملاء حتى الآن. ابدأ ببيع نظامك الخاص بالكامل!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settings Modal with Glassmorphic Overlay */}
      {showSettings && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0,0,0,0.85)', 
          backdropFilter: 'blur(8px)',
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{ 
            background: '#0f172a', 
            padding: '2.5rem', 
            borderRadius: '28px', 
            border: '1px solid var(--glass-border)', 
            width: '100%', 
            maxWidth: '600px', 
            maxHeight: '90vh', 
            overflowY: 'auto',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            direction: 'rtl'
          }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ color: 'var(--accent-primary)', fontSize: '1.6rem', fontWeight: '850' }}>
                إعدادات الدفع والدومين (White-label)
              </h2>
            </div>
            
            <p style={{ color: 'var(--text-dim)', marginBottom: '2rem', fontSize: '0.95rem', lineHeight: '1.6' }}>
              أدخل مفاتيح بوابات الدفع الخاصة بك ليتم تحصيل الاشتراكات من عملائك مباشرة إلى حسابك البنكي.
            </p>

            {successMessage && (
              <div style={{ 
                background: 'rgba(16, 185, 129, 0.1)', 
                border: '1px solid #10b981', 
                color: '#10b981', 
                padding: '1rem', 
                borderRadius: '12px', 
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                fontWeight: 'bold'
              }}>
                <CheckCircle2 size={20} />
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div style={{ 
                background: 'rgba(239, 68, 68, 0.1)', 
                border: '1px solid #ef4444', 
                color: '#ef4444', 
                padding: '1rem', 
                borderRadius: '12px', 
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                fontWeight: 'bold'
              }}>
                <AlertCircle size={20} />
                <span>{errorMessage}</span>
              </div>
            )}
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)', fontWeight: 'bold' }}>
                اسم الدومين المخصص (Custom Domain)
              </label>
              <input 
                type="text" 
                value={settingsData.custom_domain} 
                onChange={(e) => setSettingsData({...settingsData, custom_domain: e.target.value})} 
                placeholder="مثال: myagency.com"
                style={{ 
                  width: '100%', 
                  padding: '0.9rem', 
                  borderRadius: '12px', 
                  border: '1px solid var(--glass-border)', 
                  background: 'rgba(255,255,255,0.03)', 
                  color: 'var(--text-main)',
                  fontSize: '1rem'
                }} 
              />
            </div>

            <h3 style={{ marginBottom: '1rem', color: '#635BFF', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '800' }}>
              الدفع الدولي (Stripe Connect)
            </h3>
            <div style={{ marginBottom: '1.2rem', background: 'rgba(99, 91, 255, 0.08)', padding: '1.2rem', borderRadius: '16px', border: '1px solid rgba(99, 91, 255, 0.2)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '0', lineHeight: '1.6' }}>
                لتحصيل أرباحك مباشرة، يرجى ربط حسابك في Stripe (Stripe Connect Account ID). 
                نحن نقتطع عمولة التشغيل آلياً ونرسل باقي المبلغ مباشرة إلى حسابك البنكي المربوط بـ Stripe.
              </p>
            </div>
            
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)', fontWeight: 'bold' }}>
                Stripe Connect Account ID <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                type="text" 
                value={settingsData.stripe_account_id} 
                onChange={(e) => setSettingsData({...settingsData, stripe_account_id: e.target.value})} 
                placeholder="acct_1OuXXXXX..."
                style={{ 
                  width: '100%', 
                  padding: '0.9rem', 
                  borderRadius: '12px', 
                  border: '1px solid var(--glass-border)', 
                  background: 'rgba(255,255,255,0.03)', 
                  color: 'var(--text-main)',
                  fontSize: '1rem',
                  direction: 'ltr',
                  textAlign: 'right'
                }} 
              />
            </div>

            <h3 style={{ marginBottom: '1rem', color: '#0055FF', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '800' }}>
              الدفع المحلي (Paymob)
            </h3>
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)', fontWeight: 'bold' }}>
                Paymob API Key
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPaymobKey ? "text" : "password"} 
                  value={settingsData.paymob_api_key} 
                  onChange={(e) => setSettingsData({...settingsData, paymob_api_key: e.target.value})} 
                  style={{ 
                    width: '100%', 
                    padding: '0.9rem 2.8rem 0.9rem 0.9rem', 
                    borderRadius: '12px', 
                    border: '1px solid var(--glass-border)', 
                    background: 'rgba(255,255,255,0.03)', 
                    color: 'var(--text-main)',
                    fontSize: '1rem',
                    direction: 'ltr',
                    textAlign: 'right'
                  }} 
                />
                <button
                  type="button"
                  onClick={() => setShowPaymobKey(!showPaymobKey)}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    right: '1rem',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0'
                  }}
                >
                  {showPaymobKey ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <small style={{ display: 'block', marginTop: '0.5rem', color: 'rgba(255,255,255,0.3)' }}>
                يتم تشفير هذا المفتاح تلقائياً في السيرفر باستخدام خوارزمية AES-256-GCM المعززة.
              </small>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button 
                onClick={() => {
                  setShowSettings(false);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                type="button"
                style={{ 
                  padding: '0.8rem 1.5rem', 
                  background: 'transparent', 
                  color: 'var(--text-dim)', 
                  border: 'none', 
                  cursor: 'pointer', 
                  fontWeight: 'bold',
                  fontSize: '1rem'
                }}
              >
                إلغاء
              </button>
              <button 
                onClick={handleSaveSettings}
                disabled={savingSettings}
                type="button"
                style={{ 
                  padding: '0.8rem 1.8rem', 
                  background: 'var(--accent-primary)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '12px', 
                  cursor: 'pointer', 
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  boxShadow: '0 4px 12px rgba(249, 115, 22, 0.2)',
                  opacity: savingSettings ? 0.7 : 1
                }}
              >
                {savingSettings ? 'جاري الحفظ المشفر...' : 'حفظ التغييرات'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
