'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Phone, Calendar, MessageSquare, Loader2, Search } from 'lucide-react';

const CustomersPage = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCustomers = async () => {
      // Group by phone to get unique customers from bookings
      const { data } = await supabase
        .from('bookings')
        .select('customer_name, customer_phone, created_at, source')
        .order('created_at', { ascending: false });
      
      // Basic unique filtering
      const unique = Array.from(new Map(data?.map(item => [item.customer_phone, item])).values());
      setCustomers(unique);
      setLoading(false);
    };
    fetchCustomers();
  }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}><Loader2 className="animate-spin" /></div>;

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '800' }}>العملاء والمرضى</h1>
          <p style={{ color: 'var(--text-dim)' }}>جميع الأشخاص الذين تفاعلوا مع الـ AI عبر المنصات المختلفة.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', background: 'var(--card-bg)', padding: '0.6rem 1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <Search size={18} color="var(--text-dim)" />
          <input type="text" placeholder="بحث بالاسم أو الرقم..." style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {customers.map((c, i) => (
          <div key={i} style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--glass-border)', display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(45deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: '800' }}>
              {c.customer_name[0]}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>{c.customer_name}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                <Phone size={14} /> {c.customer_phone || 'غير مسجل'}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-dim)' }}>
                  من: {c.source || 'WhatsApp'}
                </span>
                <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-dim)' }}>
                  آخر نشاط: {new Date(c.created_at).toLocaleDateString('ar-EG')}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
               <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <MessageSquare size={18} color="var(--accent-primary)" />
               </div>
            </div>
          </div>
        ))}
        {customers.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem', color: 'var(--text-dim)' }}>
             لا يوجد عملاء مسجلين بعد.
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomersPage;
