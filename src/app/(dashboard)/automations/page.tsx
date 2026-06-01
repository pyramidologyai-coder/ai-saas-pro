'use client';
import React, { useState, useEffect } from 'react';
import { Bot, Save, AlertTriangle, Settings2, Mic, FileText, MessageCircle, Instagram, Facebook } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getUserPermissions } from '@/lib/permissions';
import AccessDenied from '@/components/AccessDenied';

type Channel = 'whatsapp' | 'messenger' | 'instagram';

type BotTemplate = {
  id?: string;
  intent: string;
  template_text: string;
  channel: string;
  language: string;
};

const DEFAULT_TEMPLATES = [
  { intent: 'welcome', label: 'رسالة الترحيب الأولى', placeholder: 'أهلاً بك في عيادتنا! كيف يمكن للمساعد الذكي مساعدتك اليوم؟' },
  { intent: 'booking_confirmation', label: 'رسالة تأكيد الحجز', placeholder: 'تم تأكيد حجزك بنجاح. ننتظرك في الموعد المحدد!' },
  { intent: 'reminder', label: 'رسالة التذكير بالموعد', placeholder: 'تذكير ودي بموعدك غداً. يرجى التأكيد.' },
  { intent: 'fallback', label: 'رسالة عدم الفهم (التحويل لموظف)', placeholder: 'عذراً، لم أفهم طلبك بوضوح. سأقوم بتحويلك لأحد موظفي خدمة العملاء فوراً.' },
];

export default function AutomationsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  
  // Existing state
  const [dialect, setDialect] = useState('Egyptian');
  const [automations, setAutomations] = useState([
    { id: 1, type: 'رسالة شكر وتقدير بعد الزيارة (Greet and thank)', textOn: false, voiceOn: false, delayHour: 0, delayMin: 15 },
    { id: 2, type: 'تعليمات ما بعد العلاج (Post-Op Instructions)', textOn: false, voiceOn: false, delayHour: 0, delayMin: 30 },
    { id: 3, type: 'طلب تقييم على خرائط جوجل (Google Maps Review)', textOn: true, voiceOn: false, delayHour: 2, delayMin: 0 },
    { id: 4, type: 'تذكير بالموعد (قبل الزيارة بـ 24 ساعة)', textOn: true, voiceOn: false, delayHour: 24, delayMin: 0 },
  ]);

  // New state for Bot Templates
  const [activeChannel, setActiveChannel] = useState<Channel>('whatsapp');
  const [templates, setTemplates] = useState<BotTemplate[]>([]);

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const perms = await getUserPermissions(supabase, session.user);
      if (!perms || !perms.automations) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }
      setIsAuthorized(true);

      const { data: tenant } = await supabase.from('tenants').select('*').eq('user_id', session.user.id).single();
      if (tenant) {
        setTenantId(tenant.id);
        setAutomations(prev => prev.map(a => {
          if (a.id === 3) return { ...a, textOn: tenant.enable_reviews !== false };
          if (a.id === 4) return { ...a, textOn: tenant.enable_reminders !== false };
          return a;
        }));

        // Fetch Templates
        const { data: tpls } = await supabase
          .from('bot_templates')
          .select('*')
          .eq('tenant_id', tenant.id);
          
        if (tpls) {
          setTemplates(tpls);
        }
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const handleToggle = (id: number, field: 'textOn' | 'voiceOn') => {
    setAutomations(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: !item[field] } : item
    ));
  };

  const handleTimeChange = (id: number, field: 'delayHour' | 'delayMin', value: string) => {
    setAutomations(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: parseInt(value) || 0 } : item
    ));
  };

  const handleTemplateChange = (intent: string, text: string) => {
    setTemplates(prev => {
      const existing = prev.find(t => t.intent === intent && t.channel === activeChannel);
      if (existing) {
        return prev.map(t => t.intent === intent && t.channel === activeChannel ? { ...t, template_text: text } : t);
      } else {
        return [...prev, { intent, template_text: text, channel: activeChannel, language: 'ar' }];
      }
    });
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    
    try {
      // 1. Save general settings
      const enableReviews = automations.find(a => a.id === 3)?.textOn;
      const enableReminders = automations.find(a => a.id === 4)?.textOn;
      await supabase.from('tenants').update({
        enable_reviews: enableReviews,
        enable_reminders: enableReminders
      }).eq('id', tenantId);

      // 2. Save Bot Templates
      if (templates.length > 0) {
        const templatesToSave = templates.map(t => ({
          tenant_id: tenantId,
          intent: t.intent,
          template_text: t.template_text,
          channel: t.channel,
          language: t.language || 'ar'
        }));
        
        // Upsert templates (requires intent, channel, language, tenant_id to be unique constraint if we use upsert, 
        // but since we might not have a clean unique constraint in Supabase for all 4, we delete and insert for safety)
        await supabase.from('bot_templates').delete().eq('tenant_id', tenantId);
        const { error } = await supabase.from('bot_templates').insert(templatesToSave);
        if (error) throw error;
      }
      
      alert('تم حفظ كافة إعدادات وقوالب المساعد الذكي بنجاح! 🎉');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحفظ، يرجى المحاولة مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const getTemplateText = (intent: string) => {
    const tpl = templates.find(t => t.intent === intent && t.channel === activeChannel);
    return tpl ? tpl.template_text : '';
  };

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--accent-primary)', fontWeight: 600 }}>جاري تحميل الإعدادات...</div>;

  if (isAuthorized === false) {
    return <AccessDenied message="عذراً، هذه الصفحة مخصصة لمدير النظام أو المشرفين على الذكاء الاصطناعي فقط." />;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', animation: 'fadeIn 0.5s ease' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', background: 'linear-gradient(45deg, var(--accent-primary), #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            <Bot size={32} color="var(--accent-primary)" />
            إعدادات المساعد الذكي (AI Bot)
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '1.05rem' }}>تحكم بالكامل في شخصية وردود المساعد الذكي عبر جميع المنصات.</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          style={{
            background: 'var(--accent-primary)', color: 'white', border: 'none',
            padding: '0.875rem 2rem', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 700, 
            cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)', transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <Save size={20} /> {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>

      {/* ─── SECTION 1: BOT TEMPLATES (Omnichannel) ─── */}
      <div style={{ 
        background: 'var(--card-bg)', 
        borderRadius: '24px', 
        padding: '2rem', 
        border: '1px solid var(--glass-border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        marginBottom: '2.5rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorator blob */}
        <div style={{ position: 'absolute', top: '-50px', left: '-50px', width: '150px', height: '150px', background: 'var(--accent-primary)', opacity: 0.1, filter: 'blur(50px)', borderRadius: '50%' }}></div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <MessageCircle size={24} color="var(--accent-primary)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>قوالب الردود (Bot Templates)</h2>
        </div>
        <p style={{ color: 'var(--text-dim)', marginBottom: '2rem' }}>اكتب الرسائل التي سيستخدمها الذكاء الاصطناعي في المواقف المختلفة.</p>

        {/* Channel Tabs */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '16px', width: 'fit-content' }}>
          <button 
            onClick={() => setActiveChannel('whatsapp')}
            style={{ ...tabStyle, background: activeChannel === 'whatsapp' ? '#25D366' : 'transparent', color: activeChannel === 'whatsapp' ? '#fff' : 'var(--text-dim)' }}
          >
            <MessageCircle size={18} /> واتساب (WhatsApp)
          </button>
          <button 
            onClick={() => setActiveChannel('messenger')}
            style={{ ...tabStyle, background: activeChannel === 'messenger' ? '#0084FF' : 'transparent', color: activeChannel === 'messenger' ? '#fff' : 'var(--text-dim)' }}
          >
            <Facebook size={18} /> ماسنجر (Messenger)
          </button>
          <button 
            onClick={() => setActiveChannel('instagram')}
            style={{ ...tabStyle, background: activeChannel === 'instagram' ? 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' : 'transparent', color: activeChannel === 'instagram' ? '#fff' : 'var(--text-dim)' }}
          >
            <Instagram size={18} /> انستجرام (Instagram)
          </button>
        </div>

        {/* Templates Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {DEFAULT_TEMPLATES.map((tpl, idx) => (
            <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-main)' }}>{tpl.label}</label>
              <textarea 
                value={getTemplateText(tpl.intent)}
                onChange={(e) => handleTemplateChange(tpl.intent, e.target.value)}
                placeholder={tpl.placeholder}
                style={{
                  width: '100%', height: '100px', padding: '1rem', borderRadius: '12px',
                  background: 'rgba(0,0,0,0.15)', border: '1px solid var(--glass-border)',
                  color: 'var(--text-main)', resize: 'none', fontSize: '0.95rem',
                  outline: 'none', transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ─── SECTION 2: SCHEDULED AUTOMATIONS ─── */}
      <div style={{ 
        background: 'var(--card-bg)', 
        borderRadius: '24px', 
        padding: '0', 
        border: '1px solid var(--glass-border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        marginBottom: '2.5rem'
      }}>
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Settings2 size={24} color="var(--accent-primary)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>الرسائل المجدولة (Scheduled Automations)</h2>
        </div>
        
        <div style={{ padding: '0 2rem 2rem 2rem', overflowX: 'auto' }}>
          <div style={{ background: '#f59e0b15', border: '1px solid #f59e0b30', padding: '1rem', borderRadius: '12px', margin: '1.5rem 0', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <AlertTriangle size={20} color="#f59e0b" />
            <p style={{ color: '#f59e0b', fontSize: '0.9rem' }}>يرجى ضبط الأوقات بعناية، سيتم الإرسال أوتوماتيكياً للعملاء عبر الواتساب بناءً على هذه الجدولة.</p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
            <thead>
              <tr style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                <th style={thStyle}>نوع الرسالة</th>
                <th style={thStyle}><FileText size={16} style={{display:'inline', verticalAlign:'middle', marginRight:'5px'}} />نصية</th>
                <th style={thStyle}><Mic size={16} style={{display:'inline', verticalAlign:'middle', marginRight:'5px'}} />صوتية</th>
                <th style={thStyle}>وقت الإرسال المفضل</th>
              </tr>
            </thead>
            <tbody>
              {automations.map(auto => (
                <tr key={auto.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{auto.type}</td>
                  
                  <td style={tdStyle}>
                    <div onClick={() => handleToggle(auto.id, 'textOn')} style={{ ...toggleStyle, background: auto.textOn ? 'var(--accent-primary)' : 'var(--text-dim)' }}>
                      <div style={{ ...toggleDot, right: auto.textOn ? '2px' : 'calc(100% - 22px)' }}></div>
                    </div>
                  </td>

                  <td style={tdStyle}>
                    <div onClick={() => handleToggle(auto.id, 'voiceOn')} style={{ ...toggleStyle, background: auto.voiceOn ? 'var(--accent-primary)' : 'var(--text-dim)' }}>
                      <div style={{ ...toggleDot, right: auto.voiceOn ? '2px' : 'calc(100% - 22px)' }}></div>
                    </div>
                  </td>

                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>بعد</span>
                      <input type="number" min="0" value={auto.delayHour} onChange={(e) => handleTimeChange(auto.id, 'delayHour', e.target.value)} style={inputStyle} />
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>ساعة و</span>
                      <input type="number" min="0" max="59" value={auto.delayMin} onChange={(e) => handleTimeChange(auto.id, 'delayMin', e.target.value)} style={inputStyle} />
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>دقيقة</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── SECTION 3: DIALECT ─── */}
      <div style={{ 
        background: 'var(--card-bg)', 
        borderRadius: '24px', 
        padding: '2rem', 
        border: '1px solid var(--glass-border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
      }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>لهجة الـ AI (Message Dialect)</h3>
        <p style={{ color: 'var(--text-dim)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>اختر اللهجة التي سيتحدث بها الذكاء الاصطناعي في الردود التلقائية التي يولدها بنفسه.</p>
        <select 
          value={dialect}
          onChange={(e) => setDialect(e.target.value)}
          style={{ ...inputStyle, width: '100%', maxWidth: '400px', padding: '1rem', direction: 'rtl', borderRadius: '12px' }}
        >
          <option value="Egyptian">المصرية (Egyptian 🇪🇬)</option>
          <option value="Saudi">السعودية (Saudi Arabia 🇸🇦)</option>
          <option value="MSA">العربية الفصحى (Standard Arabic 🌍)</option>
        </select>
      </div>

    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'right', padding: '1.2rem', fontWeight: 600, borderBottom: '1px solid var(--glass-border)' };
const tdStyle: React.CSSProperties = { padding: '1.2rem', color: 'var(--text-main)', verticalAlign: 'middle' };
const toggleStyle: React.CSSProperties = { width: '46px', height: '24px', borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: 'background 0.3s' };
const toggleDot: React.CSSProperties = { width: '20px', height: '20px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', transition: 'right 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' };
const inputStyle: React.CSSProperties = { width: '60px', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.1)', color: 'var(--text-main)', textAlign: 'center', outline: 'none' };
const tabStyle: React.CSSProperties = { padding: '0.75rem 1.5rem', borderRadius: '12px', border: 'none', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: '0.5rem' };
