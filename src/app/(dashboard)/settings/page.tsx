'use client';

import React, { useState, useEffect } from 'react';
import styles from './Settings.module.css';
import { createClient } from '@/utils/supabase/client';
import { Settings, GitBranch, Stethoscope, MessageSquare, Plus, Link as LinkIcon, Database, CheckCircle2, Lock, KeyRound, RefreshCw, Trash2, Copy } from 'lucide-react';
import { getActiveTenant } from '@/lib/tenant';
import { saveTenantSettingsAction } from './actions';
import { createTenantApiKeyAction, listTenantApiKeysAction, regenerateTenantApiKeyAction, revokeTenantApiKeyAction } from './api-key-actions';
import { getDictionary } from '@/lib/dictionary';
import { getUserPermissions } from '@/lib/permissions';

type ApiKeyScope = 'bookings:create' | 'bookings:read';

type ApiKeyRow = {
  id: string;
  keyPrefix: string;
  name: string;
  scopes: ApiKeyScope[];
  status: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const SettingsPage = () => {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string>('trial');
  const [dict, setDict] = useState(() => getDictionary('clinic'));
  const [activeTab, setActiveTab] = useState<'general' | 'quick_setup' | 'integrations' | 'api' | 'account' | 'whitelabel'>('general');
  const [role, setRole] = useState<'admin' | 'agency' | 'master_admin'>('admin');
  const [agencyData, setAgencyData] = useState<any>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState({ text: '', type: '' });
  
  // General Settings State
  const [formData, setFormData] = useState({
    name: '',
    google_review_link: '',
    main_location_url: '',
    working_hours: '',
    custom_prompt: '',
    whatsapp_number_id: '',
    meta_token: '',
    instagram_id: '',
    zapier_webhook: '',
    custom_domain: ''
  });

  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [apiKeyName, setApiKeyName] = useState('Bookings integration');
  const [apiKeyScopes, setApiKeyScopes] = useState<Record<ApiKeyScope, boolean>>({
    'bookings:create': true,
    'bookings:read': true
  });
  const [oneTimeApiKey, setOneTimeApiKey] = useState('');
  const [apiKeyBusy, setApiKeyBusy] = useState(false);

  // White Label Settings State
  const [whiteLabelData, setWhiteLabelData] = useState({
    brand_name: '',
    logo_url: '',
    primary_color: '#6366f1',
    custom_domain: ''
  });

  // Quick Setup States
  const [branchName, setBranchName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [doctorSpecialty, setDoctorSpecialty] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadApiKeys = async (sessionToken: string, activeTenantId: string) => {
    const result = await listTenantApiKeysAction(sessionToken, activeTenantId);
    if (!result.success) {
      throw new Error(result.error);
    }
    setApiKeys(result.data);
  };

  useEffect(() => {
    async function loadSettings() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/auth';
        return;
      }

      const perms = await getUserPermissions(supabase, session.user);

      // Verify if they are a registered agency owner (they manage their reseller settings in /settings)
      const { data: agencyRes } = await supabase.from('agencies').select('id').eq('user_id', session.user.id).limit(1);
      const isAgency = agencyRes && agencyRes.length > 0;

      const isAuth = (perms && perms.role === 'admin') || isAgency || (session.user.app_metadata?.role === 'master_admin');

      if (!isAuth) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }
      setIsAuthorized(true);
      
      const data = await getActiveTenant(session.user);
      
      if (data) {
        setTenantId(data.id);
        setDict(getDictionary(data.type));
        setSubscriptionTier(data.subscription_tier || 'trial');
        setFormData({
          name: data.name || '',
          google_review_link: data.google_review_link || '',
          main_location_url: data.main_location_url || '',
          working_hours: data.working_hours || '',
          custom_prompt: data.custom_prompt || '',
          whatsapp_number_id: data.whatsapp_number_id || '',
          meta_token: data.meta_token || '',
          instagram_id: data.instagram_id || '',
          zapier_webhook: data.zapier_webhook || '',
          custom_domain: data.custom_domain || ''
        });
        await loadApiKeys(session.access_token, data.id);
      }

      // Check Role
      if (session.user.app_metadata?.role === 'master_admin') {
        setRole('master_admin');
      } else {
        const { data: agencyRes } = await supabase
          .from('agencies')
          .select('id, name, logo_url, primary_color, custom_domain')
          .eq('user_id', session.user.id)
          .limit(1);
        if (agencyRes && agencyRes.length > 0) {
          setRole('agency');
          setAgencyData(agencyRes[0]);
          setWhiteLabelData({
            brand_name: agencyRes[0].name || '',
            logo_url: agencyRes[0].logo_url || '',
            primary_color: agencyRes[0].primary_color || '#6366f1',
            custom_domain: agencyRes[0].custom_domain || ''
          });
        }
      }
      setLoading(false);
    }
    loadSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    });
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      // SECURITY: Sanitize input to prevent Mass Assignment Privilege Escalation
      const { subscription_tier, status, trial_ends_at, agency_id, ...safeFormData } = formData as any;
      
      await saveTenantSettingsAction(session.access_token, tenantId, safeFormData);
      
      setSuccessMsg('تم حفظ الإعدادات بنجاح!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      alert('حدث خطأ أثناء الحفظ.');
    } finally {
      setSaving(false);
    }
  };

  const selectedApiKeyScopes = () =>
    (Object.entries(apiKeyScopes) as Array<[ApiKeyScope, boolean]>)
      .filter(([, enabled]) => enabled)
      .map(([scope]) => scope);

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || apiKeyBusy) return;

    const scopes = selectedApiKeyScopes();
    if (scopes.length === 0) {
      alert('Select at least one API scope.');
      return;
    }

    setApiKeyBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const result = await createTenantApiKeyAction(session.access_token, tenantId, {
        name: apiKeyName,
        scopes,
      });

      if (!result.success) throw new Error(result.error);

      setOneTimeApiKey(result.data.plaintextKey);
      await loadApiKeys(session.access_token, tenantId);
      setSuccessMsg('API key created. Copy it now; it will not be shown again.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create API key.');
    } finally {
      setApiKeyBusy(false);
    }
  };

  const handleRevokeApiKey = async (apiKeyId: string) => {
    if (!tenantId || apiKeyBusy) return;
    if (!window.confirm('Revoke this API key? Existing integrations using it will stop working.')) return;

    setApiKeyBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const result = await revokeTenantApiKeyAction(session.access_token, tenantId, apiKeyId);
      if (!result.success) throw new Error(result.error);

      setOneTimeApiKey('');
      await loadApiKeys(session.access_token, tenantId);
      setSuccessMsg('API key revoked.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to revoke API key.');
    } finally {
      setApiKeyBusy(false);
    }
  };

  const handleRegenerateApiKey = async (apiKeyId: string) => {
    if (!tenantId || apiKeyBusy) return;
    if (!window.confirm('Regenerate this API key? The old key will be revoked immediately.')) return;

    setApiKeyBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const result = await regenerateTenantApiKeyAction(session.access_token, tenantId, apiKeyId);
      if (!result.success) throw new Error(result.error);

      setOneTimeApiKey(result.data.plaintextKey);
      await loadApiKeys(session.access_token, tenantId);
      setSuccessMsg('API key regenerated. Copy the new key now; it will not be shown again.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to regenerate API key.');
    } finally {
      setApiKeyBusy(false);
    }
  };

  const handleSaveWhiteLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyData) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('agencies').update({
        name: whiteLabelData.brand_name,
        logo_url: whiteLabelData.logo_url,
        primary_color: whiteLabelData.primary_color,
        custom_domain: whiteLabelData.custom_domain
      }).eq('id', agencyData.id);
      
      if (error) throw error;
      setSuccessMsg('تم حفظ إعدادات هويتك البصرية (White Label) بنجاح!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert('حدث خطأ أثناء حفظ الـ White Label.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !branchName) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('branches').insert([{ tenant_id: tenantId, name: branchName, ai_status: 'Online' }]);
      if (error) throw error;
      setBranchName('');
      setSuccessMsg('تم إضافة الفرع بنجاح!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      alert('حدث خطأ أثناء إضافة الفرع.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !doctorName || !doctorSpecialty) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('team_members').insert([{ tenant_id: tenantId, name: doctorName, role_or_specialty: doctorSpecialty }]);
      if (error) throw error;
      setDoctorName('');
      setDoctorSpecialty('');
      setSuccessMsg('تم الإضافة بنجاح!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      alert('حدث خطأ أثناء الإضافة.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.container}>جاري التحميل...</div>;

  if (isAuthorized === false) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '5rem 2rem' }}>
        <h1 style={{ color: '#ef4444', fontSize: '2rem', marginBottom: '1rem', fontWeight: 'bold' }}>غير مصرح لك بالدخول</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '1.1rem' }}>عذراً، هذه الصفحة مخصصة لمدير النظام فقط.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>مركز الإعدادات (Settings Hub)</h1>
        <p>قم بإدارة كل تفاصيل نشاطك وفروعك من مكان واحد بكل سهولة.</p>
      </div>

      <div className={styles.layout}>
        {/* Sidebar Tabs */}
        <div className={styles.sidebar}>
          <button 
            className={`${styles.tab} ${activeTab === 'general' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <Settings size={20} /> البيانات الأساسية
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'quick_setup' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('quick_setup')}
          >
            <Database size={20} /> الإعداد السريع (فروع وتخصصات)
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'integrations' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('integrations')}
          >
            <LinkIcon size={20} /> مركز الربط والتكامل (Integrations)
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'api' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('api')}
          >
            <Database size={20} /> الدومين الخاص والـ API
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'account' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('account')}
          >
            <Lock size={20} /> الحساب والأمان
          </button>
          {role === 'agency' && (
            <button
              className={`${styles.tab} ${activeTab === 'whitelabel' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('whitelabel')}
              style={{ color: activeTab === 'whitelabel' ? 'var(--accent-primary)' : '#8b5cf6' }}
            >
              <Database size={20} /> إعدادات الـ White Label
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className={styles.content}>
          {successMsg && (
            <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <CheckCircle2 size={20} /> {successMsg}
            </div>
          )}

          {/* TAB 1: General Settings */}
          {activeTab === 'general' && (
            <form onSubmit={handleSaveGeneral}>
              <h2 className={styles.sectionTitle}><Settings size={24} color="var(--accent-primary)"/> البيانات الأساسية</h2>
              
              <div className={styles.formGroup}>
                <label>اسم النشاط / المركز الرئيسي</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} className={styles.input} placeholder="مثال: عيادات د. أحمد" required />
              </div>

              <div className={styles.formGroup}>
                <label>مواعيد العمل (للرد الآلي)</label>
                <input type="text" name="working_hours" value={formData.working_hours} onChange={handleChange} className={styles.input} placeholder="مثال: يومياً من 12 ظهراً لـ 10 مساءً" />
              </div>

              <div className={styles.formGroup}>
                <label>رابط تقييم جوجل (Google Review)</label>
                <input type="url" name="google_review_link" value={formData.google_review_link} onChange={handleChange} className={styles.input} placeholder="https://g.page/review/..." />
              </div>

              <div className={styles.formGroup}>
                <label>تعليمات الذكاء الاصطناعي (Custom Prompt)</label>
                <textarea name="custom_prompt" value={formData.custom_prompt} onChange={handleChange} className={`${styles.input} ${styles.textarea}`} placeholder="أضف معلومات إضافية للذكاء الاصطناعي، مثلاً: تكلفة الكشف 500 جنيه." />
              </div>

              <button type="submit" className={styles.saveBtn} disabled={saving} style={{ marginTop: '2rem' }}>
                {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </form>
          )}

          {/* TAB 2: Quick Setup */}
          {activeTab === 'quick_setup' && (
            <div>
              <h2 className={styles.sectionTitle}><Database size={24} color="var(--accent-primary)"/> الإعداد السريع</h2>
              <p style={{ color: 'var(--text-dim)', marginBottom: '2rem' }}>من هنا تقدر تضيف الفروع والأطباء بسرعة بدون ما تروح لصفحات تانية.</p>

              {/* Quick Add Branch */}
              <form className={styles.quickAddCard} onSubmit={handleQuickAddBranch}>
                <h4><GitBranch size={20} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }}/> إضافة فرع جديد</h4>
                <div className={styles.grid2}>
                  <div className={styles.formGroup}>
                    <label>اسم الفرع</label>
                    <input type="text" value={branchName} onChange={(e) => setBranchName(e.target.value)} className={styles.input} placeholder="مثال: فرع التجمع الخامس" required />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                    <button type="submit" className={styles.saveBtn} disabled={saving} style={{ padding: '0.8rem' }}>
                      <Plus size={20} /> إضافة الفرع
                    </button>
                  </div>
                </div>
              </form>

              {/* Quick Add Provider */}
              <form className={styles.quickAddCard} onSubmit={handleQuickAddDoctor}>
                <h4><Stethoscope size={20} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }}/> إضافة {dict.provider} / تخصص</h4>
                <div className={styles.grid2}>
                  <div className={styles.formGroup}>
                    <label>اسم {dict.provider}</label>
                    <input type="text" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} className={styles.input} placeholder={`مثال: ${dict.provider} محمد`} required />
                  </div>
                  <div className={styles.formGroup}>
                    <label>التخصص أو الدور</label>
                    <input type="text" value={doctorSpecialty} onChange={(e) => setDoctorSpecialty(e.target.value)} className={styles.input} placeholder="مثال: تخصص أو وظيفة" required />
                  </div>
                </div>
                <button type="submit" className={styles.saveBtn} disabled={saving} style={{ padding: '0.8rem', marginTop: '0.5rem' }}>
                  <Plus size={20} /> إضافة {dict.provider}
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: Integrations */}
          {activeTab === 'integrations' && (
            <form onSubmit={handleSaveGeneral}>
              <h2 className={styles.sectionTitle}><LinkIcon size={24} color="var(--accent-primary)"/> ربط المنصات (Integrations)</h2>
              
              <div className={styles.quickAddCard} style={{ borderColor: '#4285F4', background: 'rgba(66, 133, 244, 0.05)' }}>
                <h4 style={{ color: '#4285F4' }}>مواعيد جوجل (Google Calendar)</h4>
                <p style={{ color: 'var(--text-dim)', marginBottom: '1rem', fontSize: '0.9rem' }}>اربط نتيجة المركز الأساسية للمواعيد.</p>
                <button 
                  type="button" 
                  onClick={async () => {
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      const res = await fetch('/api/calendar/auth', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
                        },
                        body: JSON.stringify({ tenantId })
                      });
                      const data = await res.json();
                      if (data.url) {
                        window.location.href = data.url;
                      } else {
                        alert(data.error || 'Failed to authenticate');
                      }
                    } catch (e) {
                      alert('Connection error');
                    }
                  }} 
                  className={styles.saveBtn} 
                  style={{ background: '#4285F4', display: 'inline-flex', width: 'auto', border: 'none', cursor: 'pointer' }}>
                  ربط حساب جوجل
                </button>
              </div>

              <div className={styles.quickAddCard} style={{ borderColor: '#25D366', background: 'rgba(37, 211, 102, 0.05)' }}>
                <h4 style={{ color: '#25D366' }}><MessageSquare size={20} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }}/> إعدادات الواتساب (Meta API)</h4>
                <div className={styles.formGroup}>
                  <label>رقم معرف واتساب (Phone ID)</label>
                  <input type="text" name="whatsapp_number_id" value={formData.whatsapp_number_id} onChange={handleChange} className={styles.input} placeholder="مثال: 1046139101921254" />
                </div>
                <div className={styles.formGroup}>
                  <label>توكن ميتا (Access Token)</label>
                  <input type="password" name="meta_token" value={formData.meta_token} onChange={handleChange} className={styles.input} placeholder="EAAX..." />
                </div>
              </div>

              <div className={styles.quickAddCard} style={{ borderColor: '#f97316', background: 'rgba(249, 115, 22, 0.05)' }}>
                <h4 style={{ color: '#f97316' }}><LinkIcon size={20} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }}/> ربط Zapier & Make (Webhooks)</h4>
                <p style={{ color: 'var(--text-dim)', marginBottom: '1rem', fontSize: '0.9rem' }}>أدخل رابط الـ Webhook الخاص بك ليقوم النظام بإرسال بيانات الحجوزات أو الطلبات فور اكتمالها لأي برنامج آخر (سلاك، CRM، إكسيل).</p>
                <div className={styles.formGroup}>
                  <label>رابط الـ Webhook URL</label>
                  <input type="url" name="zapier_webhook" value={formData.zapier_webhook} onChange={handleChange} className={styles.input} placeholder="https://hooks.zapier.com/hooks/catch/..." />
                </div>
              </div>

              <button type="submit" className={styles.saveBtn} disabled={saving} style={{ marginTop: '1rem' }}>
                حفظ إعدادات الربط
              </button>
            </form>
          )}

          {/* TAB 4: API & Custom Domain */}
          {activeTab === 'api' && (
            <div>
              <h2 className={styles.sectionTitle}><Database size={24} color="var(--accent-primary)"/> الدومين الخاص والربط المباشر (API)</h2>
              
              <form className={styles.quickAddCard} onSubmit={handleSaveGeneral} style={{ borderColor: '#6366f1', background: 'rgba(99, 102, 241, 0.05)' }}>
                <h4 style={{ color: '#6366f1' }}>الدومين الخاص (White-Label)</h4>
                <p style={{ color: 'var(--text-dim)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                  يمكنك استخدام نطاق خاص بنشاطك أو وكالتك (مثال: myclinic.com). 
                  قم بتوجيه إعدادات الـ DNS (A Record) إلى سيرفراتنا قبل الحفظ.
                </p>
                {subscriptionTier === 'trial' || subscriptionTier === 'basic' ? (
                  <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#ef4444' }}>
                    <Lock size={20} />
                    <span>هذه الميزة متاحة فقط في الباقات المتقدمة (Pro). يرجى ترقية حسابك لاستخدام الدومين المخصص.</span>
                  </div>
                ) : (
                  <div className={styles.formGroup}>
                    <label>اسم الدومين</label>
                    <input type="text" name="custom_domain" value={formData.custom_domain} onChange={handleChange} className={styles.input} placeholder="بدون https:// مثال: clinic.com" />
                  </div>
                )}
                <button type="submit" className={styles.saveBtn} disabled={saving} style={{ marginTop: '1rem' }}>
                  Save custom domain
                </button>
              </form>

              <div className={styles.quickAddCard} style={{ borderColor: '#8b5cf6', background: 'rgba(139, 92, 246, 0.05)' }}>
                <h4 style={{ color: '#8b5cf6', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><KeyRound size={20} /> API Keys</h4>
                <p style={{ color: 'var(--text-dim)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                  Create scoped keys for <code>/api/v1/bookings</code>. The full key is shown once only.
                </p>

                {oneTimeApiKey && (
                  <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', marginBottom: '1rem', color: '#10b981' }}>
                    <div style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Copy this key now. It will not be shown again.</div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input type="text" value={oneTimeApiKey} readOnly className={styles.input} style={{ flex: 1, fontFamily: 'monospace', color: '#10b981' }} />
                      <button type="button" className={styles.saveBtn} style={{ width: 'auto', background: '#10b981' }} onClick={() => navigator.clipboard.writeText(oneTimeApiKey)}>
                        <Copy size={18} /> Copy
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleCreateApiKey} style={{ marginBottom: '1.5rem' }}>
                  <div className={styles.grid2}>
                    <div className={styles.formGroup}>
                      <label>Key name</label>
                      <input type="text" value={apiKeyName} onChange={(e) => setApiKeyName(e.target.value)} className={styles.input} maxLength={80} required />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Scopes</label>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', paddingTop: '0.5rem' }}>
                        {(['bookings:create', 'bookings:read'] as ApiKeyScope[]).map((scope) => (
                          <label key={scope} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                            <input
                              type="checkbox"
                              checked={apiKeyScopes[scope]}
                              onChange={(e) => setApiKeyScopes({ ...apiKeyScopes, [scope]: e.target.checked })}
                            />
                            {scope}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button type="submit" className={styles.saveBtn} disabled={apiKeyBusy} style={{ marginTop: '0.5rem', background: '#8b5cf6' }}>
                    <Plus size={18} /> {apiKeyBusy ? 'Working...' : 'Create API Key'}
                  </button>
                </form>

                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {apiKeys.length === 0 ? (
                    <div style={{ color: 'var(--text-dim)', padding: '1rem', border: '1px dashed var(--glass-border)', borderRadius: '10px' }}>
                      No API keys created yet.
                    </div>
                  ) : (
                    apiKeys.map((key) => (
                      <div key={key.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr auto', gap: '0.75rem', alignItems: 'center', padding: '1rem', border: '1px solid var(--glass-border)', borderRadius: '10px', background: 'rgba(255,255,255,0.03)' }}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{key.name}</div>
                          <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', fontFamily: 'monospace' }}>ak_live_{key.keyPrefix}_...</div>
                        </div>
                        <div style={{ color: key.status === 'active' ? '#10b981' : '#ef4444', fontWeight: 700 }}>{key.status}</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                          <div>{key.scopes.join(', ')}</div>
                          <div>Created: {key.createdAt ? new Date(key.createdAt).toLocaleDateString() : '-'}</div>
                          <div>Last used: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button type="button" title="Regenerate" disabled={apiKeyBusy || key.status !== 'active'} onClick={() => handleRegenerateApiKey(key.id)} style={{ background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-main)', padding: '0.5rem', cursor: key.status === 'active' ? 'pointer' : 'not-allowed' }}>
                            <RefreshCw size={16} />
                          </button>
                          <button type="button" title="Revoke" disabled={apiKeyBusy || key.status !== 'active'} onClick={() => handleRevokeApiKey(key.id)} style={{ background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '8px', color: '#ef4444', padding: '0.5rem', cursor: key.status === 'active' ? 'pointer' : 'not-allowed' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Account & Security */}
          {activeTab === 'account' && (
            <div>
              <h2 className={styles.sectionTitle}><Lock size={24} color="var(--accent-primary)"/> الحساب والأمان</h2>

              <div className={styles.quickAddCard} style={{ borderColor: '#6366f1', background: 'rgba(99,102,241,0.05)' }}>
                <h4 style={{ color: '#6366f1', marginBottom: '1.5rem' }}>تغيير كلمة المرور</h4>

                {passwordMsg.text && (
                  <div style={{
                    padding: '0.8rem 1rem',
                    borderRadius: '10px',
                    marginBottom: '1.5rem',
                    background: passwordMsg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color: passwordMsg.type === 'success' ? '#10b981' : '#ef4444',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    {passwordMsg.type === 'success' ? <CheckCircle2 size={18}/> : <Lock size={18}/>}
                    {passwordMsg.text}
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label>كلمة المرور الجديدة</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className={styles.input}
                    placeholder="على الأقل 8 أحرف"
                    minLength={8}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>تأكيد كلمة المرور الجديدة</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className={styles.input}
                    placeholder="أعد كتابة كلمة المرور"
                  />
                </div>

                <button
                  type="button"
                  className={styles.saveBtn}
                  disabled={saving}
                  style={{ marginTop: '0.5rem' }}
                  onClick={async () => {
                    if (!newPassword || newPassword.length < 8) {
                      setPasswordMsg({ text: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل', type: 'error' });
                      return;
                    }
                    if (newPassword !== confirmPassword) {
                      setPasswordMsg({ text: 'كلمة المرور وتأكيدها غير متطابقين', type: 'error' });
                      return;
                    }
                    setSaving(true);
                    const { error } = await supabase.auth.updateUser({ password: newPassword });
                    setSaving(false);
                    if (error) {
                      setPasswordMsg({ text: 'حدث خطأ: ' + error.message, type: 'error' });
                    } else {
                      setPasswordMsg({ text: 'تم تغيير كلمة المرور بنجاح ✓', type: 'success' });
                      setNewPassword('');
                      setConfirmPassword('');
                      setTimeout(() => setPasswordMsg({ text: '', type: '' }), 4000);
                    }
                  }}
                >
                  {saving ? 'جاري الحفظ...' : 'تغيير كلمة المرور'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 6: White Label */}
          {activeTab === 'whitelabel' && role === 'agency' && (
            <form onSubmit={handleSaveWhiteLabel}>
              <h2 className={styles.sectionTitle}><Database size={24} color="#8b5cf6"/> إعدادات هويتك البصرية (White Label)</h2>
              <p style={{ color: 'var(--text-dim)', marginBottom: '2rem' }}>قم بتخصيص المنصة لتظهر لعملائك وكأنها منصتك الخاصة بالكامل.</p>

              <div className={styles.quickAddCard} style={{ borderColor: '#8b5cf6', background: 'rgba(139, 92, 246, 0.05)' }}>
                <div className={styles.formGroup}>
                  <label>اسم البراند (Brand Name)</label>
                  <input type="text" value={whiteLabelData.brand_name} onChange={e => setWhiteLabelData({...whiteLabelData, brand_name: e.target.value})} className={styles.input} placeholder="مثال: Tech Clinic AI" />
                </div>
                
                <div className={styles.formGroup}>
                  <label>رابط اللوجو (Logo URL)</label>
                  <input type="url" value={whiteLabelData.logo_url} onChange={e => setWhiteLabelData({...whiteLabelData, logo_url: e.target.value})} className={styles.input} placeholder="https://yourdomain.com/logo.png" />
                </div>

                <div className={styles.formGroup}>
                  <label>اللون الأساسي (Primary Color)</label>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input type="color" value={whiteLabelData.primary_color} onChange={e => setWhiteLabelData({...whiteLabelData, primary_color: e.target.value})} style={{ width: '50px', height: '50px', padding: 0, border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }} />
                    <input type="text" value={whiteLabelData.primary_color} onChange={e => setWhiteLabelData({...whiteLabelData, primary_color: e.target.value})} className={styles.input} style={{ flex: 1 }} />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>الدومين المخصص (Custom Domain)</label>
                  <input type="text" value={whiteLabelData.custom_domain} onChange={e => setWhiteLabelData({...whiteLabelData, custom_domain: e.target.value})} className={styles.input} placeholder="app.yourdomain.com" />
                  <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-dim)' }}>تأكد من توجيه الـ DNS (CNAME) إلى cname.vercel-dns.com</small>
                </div>
              </div>

              <button type="submit" className={styles.saveBtn} disabled={saving} style={{ marginTop: '2rem', background: '#8b5cf6' }}>
                {saving ? 'جاري الحفظ...' : 'حفظ هوية المنصة'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
