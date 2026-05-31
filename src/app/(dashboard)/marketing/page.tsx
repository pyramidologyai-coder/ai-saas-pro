'use client';
import React, { useState } from 'react';
import { Megaphone, Plus, Sparkles, Send, Users, Activity, Info } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getDictionary } from '@/lib/dictionary';

export default function MarketingPage() {
  const supabase = createClient();
  const [showModal, setShowModal] = useState(false);
  const [campaignMode, setCampaignMode] = useState<'ai' | 'template'>('template');
  const [isGenerating, setIsGenerating] = useState(false);
  const [dict, setDict] = useState(() => getDictionary('clinic'));
  const [tenantType, setTenantType] = useState('clinic');
  const [dbCampaigns, setDbCampaigns] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, recipients: 0 });
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchTenantAndCampaigns = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: tenant } = await supabase.from('tenants').select('id, type').eq('user_id', session.user.id).single();
          if (tenant) {
            setTenantType(tenant.type);
            setDict(getDictionary(tenant.type));

            const { data: campaignsData } = await supabase
              .from('campaigns')
              .select('*')
              .eq('tenant_id', tenant.id)
              .order('created_at', { ascending: false });

            if (campaignsData) {
              setDbCampaigns(campaignsData);
              setStats({
                total: campaignsData.length,
                sent: campaignsData.reduce((acc, curr) => acc + (curr.sent_count || 0), 0),
                recipients: campaignsData.reduce((acc, curr) => acc + (curr.recipients_count || 0), 0)
              });
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTenantAndCampaigns();
  }, []);

  // Mock Data
  // Real data is fetched from Supabase

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      alert('تم إنشاء نص الحملة التسويقية بنجاح باستخدام الذكاء الاصطناعي!');
      setShowModal(false);
    }, 1500);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Megaphone size={28} color="var(--accent-primary)" />
            التسويق وحملات الواتساب
          </h1>
          <p style={{ color: 'var(--text-dim)' }}>أعد استهداف {dict.customers} وزود أرباحك بضغطة زرار (Retarget your {dict.customers})</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          style={{ 
            background: 'var(--accent-primary)', color: 'white', border: 'none', 
            padding: '0.8rem 1.5rem', borderRadius: '12px', fontWeight: 600, 
            display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
          }}
        >
          <Plus size={20} /> إطلاق حملة جديدة
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--text-dim)', fontSize: '1rem' }}>إجمالي الحملات</h3>
            <Activity size={20} color="#10b981" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.total.toLocaleString()}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--text-dim)', fontSize: '1rem' }}>الرسائل المرسلة</h3>
            <Send size={20} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.sent.toLocaleString()}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--text-dim)', fontSize: '1rem' }}>إجمالي {dict.customers} المستهدفين</h3>
            <Users size={20} color="#a855f7" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.recipients.toLocaleString()}</div>
        </div>
      </div>

      {/* Campaigns Table */}
      <div style={{ ...cardStyle, padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>سجل الحملات (Campaigns History)</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                <th style={thStyle}>اسم الحملة</th>
                <th style={thStyle}>النوع</th>
                <th style={thStyle}>تاريخ الإرسال</th>
                <th style={thStyle}>الحالة</th>
                <th style={thStyle}>عدد المستلمين</th>
                <th style={thStyle}>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
                    جاري التحميل...
                  </td>
                </tr>
              ) : dbCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <Megaphone size={48} color="rgba(255,255,255,0.1)" />
                      <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>لا توجد حملات بعد</div>
                      <div style={{ fontSize: '0.9rem' }}>اضغط + إطلاق حملة جديدة</div>
                    </div>
                  </td>
                </tr>
              ) : (
                dbCampaigns.map(camp => (
                  <tr key={camp.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text-bright)' }}>{camp.name}</td>
                    <td style={{ ...tdStyle, color: '#f59e0b' }}>{camp.type}</td>
                    <td style={tdStyle}>{new Date(camp.created_at).toLocaleString('ar-EG')}</td>
                    <td style={tdStyle}>
                      <span style={{ background: '#10b98115', color: '#10b981', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
                        {camp.status}
                      </span>
                    </td>
                    <td style={tdStyle}>{camp.recipients_count}</td>
                    <td style={tdStyle}>
                      <button style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>التفاصيل</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Campaign Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-color)', border: '1px solid var(--glass-border)',
            borderRadius: '24px', width: '90%', maxWidth: '600px', padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>إطلاق حملة تسويقية جديدة</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
              <button 
                onClick={() => setCampaignMode('ai')}
                style={{ ...modeBtnStyle, border: campaignMode === 'ai' ? '2px solid var(--accent-primary)' : '1px solid var(--glass-border)', background: campaignMode === 'ai' ? 'var(--accent-primary)15' : 'transparent' }}
              >
                <Sparkles size={18} color={campaignMode === 'ai' ? 'var(--accent-primary)' : 'var(--text-dim)'} />
                <span style={{ color: campaignMode === 'ai' ? 'var(--accent-primary)' : 'var(--text-main)' }}>توليد نص بالـ AI</span>
              </button>
              <button 
                onClick={() => setCampaignMode('template')}
                style={{ ...modeBtnStyle, border: campaignMode === 'template' ? '2px solid var(--accent-primary)' : '1px solid var(--glass-border)', background: campaignMode === 'template' ? 'var(--accent-primary)15' : 'transparent' }}
              >
                <span style={{ color: campaignMode === 'template' ? 'var(--accent-primary)' : 'var(--text-main)' }}>قوالب ميتا المعتمدة</span>
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <p style={{ fontSize: '0.85rem', color: '#60a5fa', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Info size={16} /> تنويه: شركة ميتا (واتساب) تمنع إرسال رسائل تسويقية حرة. يجب اختيار "قالب معتمد" (Template) مسبقاً للحملات.
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>الجمهور المستهدف</label>
              <select style={inputStyle}>
                <option>كل الـ {dict.customers} المسجلين في النظام</option>
                <option>الـ {dict.customers} الذين لم يتواصلوا منذ 3 أشهر</option>
                <option>الـ {dict.customers} الذين لم يكملوا {dict.bookings}</option>
              </select>
            </div>

            {campaignMode === 'ai' && (
              <div style={{ background: '#f59e0b10', border: '1px solid #f59e0b30', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                <p style={{ color: '#f59e0b', fontSize: '0.9rem', display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
                  <Sparkles size={16} /> سنقوم بصياغة قالب احترافي وإرساله لميتا للموافقة (يستغرق 5 دقائق).
                </p>
                <input type="text" placeholder={`مثال: عرض خصم 30% على ${dict.item} بمناسبة العيد`} style={inputStyle} />
              </div>
            )}

            {campaignMode === 'template' && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>اختر القالب المعتمد من ميتا</label>
                <select style={inputStyle} disabled>
                  <option value="">لا توجد قوالب معتمدة بعد (قم بإضافة قوالب من Meta Business)</option>
                </select>
              </div>
            )}

            <button 
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{
                width: '100%', background: 'var(--accent-primary)', color: 'white', border: 'none',
                padding: '1rem', borderRadius: '12px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem'
              }}
            >
              {isGenerating ? 'جاري التنفيذ...' : (campaignMode === 'ai' ? 'اعتماد وإرسال لميتا' : 'إرسال الحملة الآن')} <Send size={18} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'var(--card-bg)',
  borderRadius: '24px',
  padding: '1.5rem',
  border: '1px solid var(--glass-border)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.05)'
};

const thStyle: React.CSSProperties = {
  textAlign: 'right',
  padding: '1.2rem',
  fontWeight: 600,
  borderBottom: '1px solid var(--glass-border)'
};

const tdStyle: React.CSSProperties = {
  padding: '1.2rem',
  color: 'var(--text-dim)'
};

const modeBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '1rem',
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '1rem',
  borderRadius: '12px',
  border: '1px solid var(--glass-border)',
  background: 'rgba(0,0,0,0.1)',
  color: 'var(--text-main)',
  fontSize: '1rem',
  outline: 'none',
};
