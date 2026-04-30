'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { CreditCard, Check, Zap, AlertTriangle, Wallet } from 'lucide-react';

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<any>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from('tenants').select('*').eq('user_id', session.user.id).single();
      setTenant(data);
      setLoading(false);
    }
    loadData();
  }, []);

  const handleSubscribe = async (gateway: 'stripe' | 'paymob', planId: string) => {
    if (!tenant) return;
    setProcessing(`${gateway}-${planId}`);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          tenantId: tenant.id,
          planId,
          gateway
        })
      });

      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url; // Redirect to Stripe Checkout
      } else {
        alert(data.error || 'حدث خطأ أثناء الاتصال ببوابة الدفع.');
        setProcessing(null);
      }
    } catch (err) {
      alert('خطأ في الاتصال بالخادم.');
      setProcessing(null);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>جاري التحميل...</div>;

  const isExpired = tenant?.trial_ends_at && new Date() > new Date(tenant.trial_ends_at) && tenant?.subscription_tier === 'trial';

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', color: 'var(--text-main)' }}>
      
      {isExpired && (
        <div style={{ background: '#ef444415', border: '1px solid #ef444440', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <AlertTriangle size={32} color="#ef4444" />
          <div>
            <h3 style={{ color: '#ef4444', marginBottom: '0.2rem', fontWeight: 800 }}>انتهت الفترة التجريبية! (Trial Expired)</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>توقف الذكاء الاصطناعي عن الرد على عملائك. يرجى الاشتراك في إحدى الباقات أدناه لإعادة التفعيل الفوري.</p>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>الباقات والاشتراكات</h1>
        <p style={{ color: 'var(--text-dim)' }}>اختر الباقة المناسبة لحجم عملك. يمكنك الدفع بالبطاقات الدولية أو المحلية أو المحافظ الإلكترونية.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        
        {/* Basic Plan */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '2rem', position: 'relative' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>الباقة الأساسية</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>مثالية للعيادات والمطاعم الناشئة.</p>
          
          <div style={{ marginBottom: '2rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 900 }}>$50</span>
            <span style={{ color: 'var(--text-dim)' }}> / شهرياً</span>
            <div style={{ fontSize: '0.85rem', color: '#a855f7', fontWeight: 600, marginTop: '0.2rem' }}>(أو ما يعادلها محلياً)</div>
          </div>

          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {['1,000 رد ذكاء اصطناعي (AI Replies)', 'لوحة تحكم كاملة للحجوزات', 'دعم فني عبر البريد الإلكتروني', 'رسائل التذكير التلقائية'].map((feature, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem' }}>
                <Check size={18} color="#10b981" /> {feature}
              </li>
            ))}
          </ul>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button 
              onClick={() => handleSubscribe('stripe', 'basic')}
              disabled={processing !== null}
              style={{ width: '100%', padding: '1rem', background: '#635BFF', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
            >
              <CreditCard size={18} /> الدفع الدولي (Stripe)
            </button>
            <button 
              onClick={() => handleSubscribe('paymob', 'basic')}
              disabled={processing !== null}
              style={{ width: '100%', padding: '1rem', background: '#0055FF', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
            >
              <Wallet size={18} /> الدفع المحلي (Paymob)
            </button>
          </div>
        </div>

        {/* Pro Plan */}
        <div style={{ background: 'linear-gradient(145deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)', border: '1px solid #a855f7', borderRadius: '24px', padding: '2rem', position: 'relative', boxShadow: '0 8px 32px rgba(168, 85, 247, 0.15)' }}>
          <div style={{ position: 'absolute', top: '-15px', right: '2rem', background: 'linear-gradient(to right, #6366f1, #a855f7)', color: 'white', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Zap size={14} /> الأكثر طلباً
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem', color: '#a855f7' }}>الباقة الاحترافية (PRO)</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>للمؤسسات ذات الضغط العالي والتي تبحث عن أقصى استفادة تسويقية.</p>
          
          <div style={{ marginBottom: '2rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 900 }}>$100</span>
            <span style={{ color: 'var(--text-dim)' }}> / شهرياً</span>
            <div style={{ fontSize: '0.85rem', color: '#a855f7', fontWeight: 600, marginTop: '0.2rem' }}>(أو ما يعادلها محلياً)</div>
          </div>

          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {['5,000 رد ذكاء اصطناعي (AI Replies)', 'إرسال رسائل مجمعة (Bulk WhatsApp Marketing)', 'ربط بـ Zapier وأنظمة الـ CRM', 'أولوية الدعم الفني (Priority Support)'].map((feature, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem' }}>
                <Check size={18} color="#a855f7" /> {feature}
              </li>
            ))}
          </ul>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button 
              onClick={() => handleSubscribe('stripe', 'pro')}
              disabled={processing !== null}
              style={{ width: '100%', padding: '1rem', background: '#635BFF', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
            >
              <CreditCard size={18} /> الدفع الدولي (Stripe)
            </button>
            <button 
              onClick={() => handleSubscribe('paymob', 'pro')}
              disabled={processing !== null}
              style={{ width: '100%', padding: '1rem', background: '#0055FF', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
            >
              <Wallet size={18} /> الدفع المحلي (Paymob)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
