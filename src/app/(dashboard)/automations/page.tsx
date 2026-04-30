'use client';
import React, { useState, useEffect } from 'react';
import { Bot, Save, AlertTriangle, Settings2, Mic, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AutomationsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [dialect, setDialect] = useState('Egyptian');

  const [automations, setAutomations] = useState([
    { id: 1, type: 'رسالة شكر وتقدير بعد الزيارة (Greet and thank)', textOn: false, voiceOn: false, delayHour: 0, delayMin: 15 },
    { id: 2, type: 'تعليمات ما بعد العلاج (Post-Op Instructions)', textOn: false, voiceOn: false, delayHour: 0, delayMin: 30 },
    { id: 3, type: 'طلب تقييم على خرائط جوجل (Google Maps Review)', textOn: true, voiceOn: false, delayHour: 2, delayMin: 0 },
    { id: 4, type: 'تذكير بالموعد (قبل الزيارة بـ 24 ساعة)', textOn: true, voiceOn: false, delayHour: 24, delayMin: 0 },
  ]);

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from('tenants').select('*').eq('user_id', session.user.id).single();
      if (data) {
        setTenantId(data.id);
        setAutomations(prev => prev.map(a => {
          if (a.id === 3) return { ...a, textOn: data.enable_reviews !== false };
          if (a.id === 4) return { ...a, textOn: data.enable_reminders !== false };
          return a;
        }));
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

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    
    const enableReviews = automations.find(a => a.id === 3)?.textOn;
    const enableReminders = automations.find(a => a.id === 4)?.textOn;

    try {
      await supabase.from('tenants').update({
        enable_reviews: enableReviews,
        enable_reminders: enableReminders
      }).eq('id', tenantId);
      
      alert('تم حفظ إعدادات الرسائل التلقائية بنجاح!');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>جاري التحميل...</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Bot size={28} color="var(--accent-primary)" />
            الرسائل التلقائية والمتابعة (Automations)
          </h1>
          <p style={{ color: 'var(--text-dim)' }}>إدارة الرسائل المجدولة اللي الذكاء الاصطناعي بيبعتها للمرضى أوتوماتيك</p>
        </div>
      </div>

      <div style={{ background: '#f59e0b10', border: '1px solid #f59e0b30', padding: '1rem 1.5rem', borderRadius: '12px', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <AlertTriangle size={24} color="#f59e0b" />
        <p style={{ color: '#f59e0b', fontSize: '0.95rem' }}>
          يرجى التحقق من الأوقات والإعدادات، لأن هذه الرسائل سيتم إرسالها للعملاء على الواتساب بشكل فوري وتلقائي حسب الجدول.
        </p>
      </div>

      <div style={{ 
        background: 'var(--card-bg)', 
        borderRadius: '24px', 
        padding: '0', 
        border: '1px solid var(--glass-border)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
        overflow: 'hidden',
        marginBottom: '2rem'
      }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Settings2 size={20} color="var(--accent-primary)" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>الرسائل العامة (General Messages)</h2>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                <th style={thStyle}>نوع الرسالة (MESSAGE TYPE)</th>
                <th style={thStyle}><FileText size={16} style={{display:'inline', verticalAlign:'middle', marginRight:'5px'}} />رسالة نصية</th>
                <th style={thStyle}><Mic size={16} style={{display:'inline', verticalAlign:'middle', marginRight:'5px'}} />رسالة صوتية (Voice Note)</th>
                <th style={thStyle}>وقت الإرسال (TIMING PREFERENCE)</th>
              </tr>
            </thead>
            <tbody>
              {automations.map(auto => (
                <tr key={auto.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{auto.type}</td>
                  
                  {/* Text Toggle */}
                  <td style={tdStyle}>
                    <div 
                      onClick={() => handleToggle(auto.id, 'textOn')}
                      style={{ ...toggleStyle, background: auto.textOn ? 'var(--accent-primary)' : 'var(--text-dim)' }}
                    >
                      <div style={{ ...toggleDot, right: auto.textOn ? '2px' : 'calc(100% - 22px)' }}></div>
                    </div>
                  </td>

                  {/* Voice Toggle */}
                  <td style={tdStyle}>
                    <div 
                      onClick={() => handleToggle(auto.id, 'voiceOn')}
                      style={{ ...toggleStyle, background: auto.voiceOn ? 'var(--accent-primary)' : 'var(--text-dim)' }}
                    >
                      <div style={{ ...toggleDot, right: auto.voiceOn ? '2px' : 'calc(100% - 22px)' }}></div>
                    </div>
                  </td>

                  {/* Timing Preference */}
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>بعد</span>
                      <input 
                        type="number" min="0" value={auto.delayHour}
                        onChange={(e) => handleTimeChange(auto.id, 'delayHour', e.target.value)}
                        style={inputStyle} 
                      />
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>ساعة</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>و</span>
                      <input 
                        type="number" min="0" max="59" value={auto.delayMin}
                        onChange={(e) => handleTimeChange(auto.id, 'delayMin', e.target.value)}
                        style={inputStyle} 
                      />
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>دقيقة</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Message Dialect Section */}
      <div style={{ 
        background: 'var(--card-bg)', 
        borderRadius: '24px', 
        padding: '2rem', 
        border: '1px solid var(--glass-border)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
        marginBottom: '2rem'
      }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>لهجة الـ AI (Message Dialect)</h3>
        <p style={{ color: 'var(--text-dim)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          اختر اللهجة التي سيتحدث بها الذكاء الاصطناعي في الرسائل النصية والصوتية.
        </p>
        <select 
          value={dialect}
          onChange={(e) => setDialect(e.target.value)}
          style={{ ...inputStyle, width: '100%', maxWidth: '400px', padding: '1rem', direction: 'rtl' }}
        >
          <option value="Egyptian">المصرية (Egyptian)</option>
          <option value="Saudi">السعودية (Saudi Arabia)</option>
          <option value="MSA">العربية الفصحى (Modern Standard Arabic)</option>
        </select>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button 
          onClick={handleSave} 
          disabled={saving}
          style={{
            background: 'var(--accent-primary)', color: 'white', border: 'none',
            padding: '1rem 3rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 700, 
            cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)'
          }}
        >
          <Save size={20} /> {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </button>
      </div>

    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'right',
  padding: '1.2rem',
  fontWeight: 600,
  borderBottom: '1px solid var(--glass-border)'
};

const tdStyle: React.CSSProperties = {
  padding: '1.2rem',
  color: 'var(--text-main)',
  verticalAlign: 'middle'
};

const toggleStyle: React.CSSProperties = {
  width: '46px',
  height: '24px',
  borderRadius: '20px',
  position: 'relative',
  cursor: 'pointer',
  transition: 'background 0.3s'
};

const toggleDot: React.CSSProperties = {
  width: '20px',
  height: '20px',
  background: 'white',
  borderRadius: '50%',
  position: 'absolute',
  top: '2px',
  transition: 'right 0.3s',
  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
};

const inputStyle: React.CSSProperties = {
  width: '60px',
  padding: '0.5rem',
  borderRadius: '8px',
  border: '1px solid var(--glass-border)',
  background: 'rgba(0,0,0,0.1)',
  color: 'var(--text-main)',
  textAlign: 'center',
  outline: 'none',
};
