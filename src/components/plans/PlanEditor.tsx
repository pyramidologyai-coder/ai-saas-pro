'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Save } from 'lucide-react';
import { savePlanAction } from '@/app/(dashboard)/super-admin/actions';

export const PlanEditor = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('plans').select('*').order('price_monthly', { ascending: true }).then(({ data }) => {
      setPlans(data || []);
      setLoading(false);
    });
  }, []);

  const handleInputChange = (id: string, field: string, value: any) => {
    setPlans(plans.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const savePlan = async (plan: any) => {
    try {
      setSavingId(plan.id);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('يرجى تسجيل الدخول');
        return;
      }

      await savePlanAction(session.access_token, plan, session.user.id);

      alert('تم حفظ الباقة بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء الحفظ: ' + (err.message || 'غير معروف'));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
     return <div className="flex justify-center p-8"><Loader2 className="animate-spin" color="var(--accent-primary)" size={40} /></div>;
  }

  return (
    <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--glass-border)' }} dir="rtl">
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '2rem', color: 'var(--text-main)' }}>تعديل تفاصيل الباقات</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {plans.map(p => (
          <div key={p.id} style={{ border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '1.5rem', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-primary)' }}>{p.name}</h3>
              <button 
                onClick={() => savePlan(p)}
                disabled={savingId === p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  background: 'var(--accent-primary)', color: 'white', border: 'none',
                  padding: '0.6rem 1.5rem', borderRadius: '12px', fontWeight: 'bold',
                  cursor: savingId === p.id ? 'not-allowed' : 'pointer',
                  opacity: savingId === p.id ? 0.7 : 1
                }}
              >
                {savingId === p.id ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                حفظ الباقة
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {/* الأسعار الأساسية */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 600 }}>السعر الشهري (ر.س)</label>
                <input 
                  type="number" 
                  value={p.price_monthly} 
                  onChange={(e) => handleInputChange(p.id, 'price_monthly', e.target.value)}
                  style={{ padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', color: 'var(--text-main)', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 600 }}>السعر السنوي (ر.س)</label>
                <input 
                  type="number" 
                  value={p.price_yearly} 
                  onChange={(e) => handleInputChange(p.id, 'price_yearly', e.target.value)}
                  style={{ padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', color: 'var(--text-main)', outline: 'none' }}
                />
              </div>

              {/* حدود الاستخدام */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 600 }}>حد الرسائل (-1 لغير المحدود)</label>
                <input 
                  type="number" 
                  value={p.messages_limit} 
                  onChange={(e) => handleInputChange(p.id, 'messages_limit', e.target.value)}
                  style={{ padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', color: 'var(--text-main)', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 600 }}>حد الصوت بالدقائق (-1)</label>
                <input 
                  type="number" 
                  value={p.voice_minutes_limit} 
                  onChange={(e) => handleInputChange(p.id, 'voice_minutes_limit', e.target.value)}
                  style={{ padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', color: 'var(--text-main)', outline: 'none' }}
                />
              </div>

              {/* الإضافات */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 600 }}>رصيد التذكيرات</label>
                <input 
                  type="number" 
                  value={p.reminder_credits} 
                  onChange={(e) => handleInputChange(p.id, 'reminder_credits', e.target.value)}
                  style={{ padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', color: 'var(--text-main)', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 600 }}>سعر 500 رسالة (ر.س)</label>
                <input 
                  type="number" 
                  value={p.extra_500_price} 
                  onChange={(e) => handleInputChange(p.id, 'extra_500_price', e.target.value)}
                  style={{ padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', color: 'var(--text-main)', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 600 }}>سعر 1000 رسالة (ر.س)</label>
                <input 
                  type="number" 
                  value={p.extra_1000_price} 
                  onChange={(e) => handleInputChange(p.id, 'extra_1000_price', e.target.value)}
                  style={{ padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', color: 'var(--text-main)', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 600 }}>سعر 5000 رسالة (ر.س)</label>
                <input 
                  type="number" 
                  value={p.extra_5000_price} 
                  onChange={(e) => handleInputChange(p.id, 'extra_5000_price', e.target.value)}
                  style={{ padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', color: 'var(--text-main)', outline: 'none' }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
