'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, CreditCard, PhoneCall } from 'lucide-react';

export default function TrialBlocker({ children }: { children: React.ReactNode }) {
  const [isExpired, setIsExpired] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkTrial() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setLoading(false);
          return;
        }

        // Bypass trial blocker for Master Admins
        if (session.user.user_metadata?.role === 'master_admin') {
          setLoading(false);
          return;
        }

        const { data: tenant } = await supabase
          .from('tenants')
          .select('trial_ends_at, subscription_tier')
          .eq('user_id', session.user.id)
          .single();

        if (tenant && tenant.trial_ends_at && tenant.subscription_tier === 'trial') {
          const expirationDate = new Date(tenant.trial_ends_at);
          if (new Date() > expirationDate) {
            setIsExpired(true);
          }
        }
      } catch (err) {
        console.error('Error checking trial:', err);
      } finally {
        setLoading(false);
      }
    }
    
    checkTrial();
  }, []);

  if (loading) return null; // Or a loading spinner

  if (isExpired) {
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <div style={{
          background: 'var(--card-bg)',
          padding: '3rem',
          borderRadius: '24px',
          border: '1px solid rgba(255, 75, 75, 0.3)',
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}>
          <AlertTriangle size={64} color="#ff4b4b" style={{ margin: '0 auto 1.5rem' }} />
          <h1 style={{ fontSize: '1.8rem', marginBottom: '1rem', color: 'white' }}>انتهت الفترة التجريبية</h1>
          <p style={{ color: 'var(--text-dim)', marginBottom: '2rem', lineHeight: '1.6' }}>
            لقد انتهت فترة الـ 7 أيام المجانية بنجاح. نتمنى أن يكون النظام قد نال إعجابكم وساهم في زيادة مبيعاتكم. 
            لاستمرار عمل الذكاء الاصطناعي مع عملائكم، يرجى تجديد الاشتراك.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              border: 'none',
              padding: '1rem',
              borderRadius: '12px',
              fontSize: '1.1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}>
              <CreditCard size={20} />
              تجديد الاشتراك الآن
            </button>
            
            <button style={{
              background: 'transparent',
              color: 'var(--text-dim)',
              border: '1px solid var(--glass-border)',
              padding: '1rem',
              borderRadius: '12px',
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}>
              <PhoneCall size={20} />
              تواصل مع المبيعات
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
