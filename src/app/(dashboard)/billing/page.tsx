'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { CreditCard, Check, Zap, AlertTriangle, Wallet, Calendar, Activity, Star } from 'lucide-react';
import UsageProgressBar from '@/components/financial/UsageProgressBar';
import { getUserPermissions } from '@/lib/permissions';

export default function BillingPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const perms = await getUserPermissions(supabase, session.user);
      if (!perms || !perms.canViewRevenue) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }
      setIsAuthorized(true);

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

  if (isAuthorized === false) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', maxWidth: '1000px', margin: '0 auto', color: 'var(--text-main)' }}>
        <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', padding: '3rem 2rem', borderRadius: '24px', textAlign: 'center' }}>
          <h1 style={{ color: '#ef4444', fontSize: '2rem', marginBottom: '1rem', fontWeight: 'bold' }}>غير مصرح لك بالدخول</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '1.1rem' }}>عذراً، هذه الصفحة مخصصة لمدير النظام أو الحسابات فقط.</p>
        </div>
      </div>
    );
  }

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

      {/* Current Plan Overview */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '2rem', marginBottom: '3rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '150px', height: '150px', background: 'radial-gradient(circle, var(--accent-primary-transparent) 0%, transparent 70%)', transform: 'translate(50%, -50%)' }}></div>
        
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Star color="var(--accent-primary)" /> باقتك الحالية
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
          <div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '0.3rem' }}>نوع الباقة</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'capitalize', color: 'var(--accent-primary)' }}>
              {tenant?.plan_type || 'Trial'}
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Calendar size={14} /> تاريخ التجديد
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
              {tenant?.subscription_end_date ? new Date(tenant.subscription_end_date).toLocaleDateString('ar-EG') : 'غير محدد'}
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Activity size={14} /> الاستهلاك الشهري (Usage)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <UsageProgressBar 
                  used={tenant?.messages_used || 0} 
                  limit={tenant?.messages_limit || 1000} 
                  label="رسائل الـ AI" 
                  isUnlimited={tenant?.plan_type === 'vip'} 
                />
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <UsageProgressBar 
                  used={tenant?.voice_minutes_used || 0} 
                  limit={tenant?.voice_minutes_limit || 60} 
                  label="المكالمات الصوتية (دقائق)" 
                  isUnlimited={tenant?.plan_type === 'vip'} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>

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
