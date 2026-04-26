'use client';
import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  Users, 
  CalendarCheck, 
  MessageCircle 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [stats, setStats] = useState([
    { label: 'إجمالي الحجوزات', value: '...', trend: '+0%', icon: CalendarCheck, color: '#6366f1' },
    { label: 'مرضى جدد', value: '...', trend: '+0%', icon: Users, color: '#a855f7' },
    { label: 'رسائل AI', value: '...', trend: '+0%', icon: MessageCircle, color: '#06b6d4' },
    { label: 'الإيرادات', value: '...', trend: '+0%', icon: TrendingUp, color: '#10b981' },
  ]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.href = '/auth';
          return;
        }
        const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', session.user.id).single();
        if (!tenant) return;

        // 1. Fetch total bookings
        const { count: bookingCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id);
        
        // 2. Fetch unique customers (new patients)
        const { data: customers } = await supabase.from('bookings').select('customer_phone').eq('tenant_id', tenant.id);
        const uniqueCustomers = new Set(customers?.map(c => c.customer_phone)).size;

        // 3. Fetch recent bookings
        const { data: bookings } = await supabase
          .from('bookings')
          .select(`
            *,
            items (name)
          `)
          .eq('tenant_id', tenant.id)
          .order('booking_time', { ascending: false })
          .limit(5);

        setStats(prev => [
          { ...prev[0], value: bookingCount?.toString() || '0' },
          { ...prev[1], value: uniqueCustomers.toString() },
          { ...prev[2], value: (bookingCount ? bookingCount * 3 : 0).toString() }, // Simulated AI messages
          { ...prev[3], value: (bookingCount ? bookingCount * 550 : 0).toLocaleString() + ' ج.م' },
        ]);

        setRecentBookings(bookings || []);
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        {stats.map((stat, i) => (
          <div key={i} style={{
            background: 'var(--card-bg)',
            padding: '1.5rem',
            borderRadius: '24px',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'blur(10px)',
            transition: '0.3s'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '14px', 
                background: `${stat.color}15`, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: stat.color
              }}>
                <stat.icon size={24} />
              </div>
              <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>{stat.trend}</span>
            </div>
            <h3 style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{stat.label}</h3>
            <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{stat.value}</div>
          </div>
        ))}
      </section>

      <section style={{ 
        background: 'var(--card-bg)', 
        borderRadius: '24px', 
        padding: '2rem', 
        border: '1px solid var(--glass-border)' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2>أحدث الحجوزات القادمة</h2>
          <button style={{ 
            background: 'var(--accent-primary)', 
            color: 'var(--text-main)', 
            border: 'none', 
            padding: '0.6rem 1.2rem', 
            borderRadius: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}>تحديث البيانات</button>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)' }}>
                <th style={{ textAlign: 'right', padding: '1rem' }}>المريض / العميل</th>
                <th style={{ textAlign: 'right', padding: '1rem' }}>الخدمة</th>
                <th style={{ textAlign: 'right', padding: '1rem' }}>التوقيت</th>
                <th style={{ textAlign: 'right', padding: '1rem' }}>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1.2rem' }}>{row.customer_name}</td>
                  <td style={{ padding: '1.2rem' }}>{row.items?.name || 'خدمة عامة'}</td>
                  <td style={{ padding: '1.2rem' }}>{new Date(row.booking_time).toLocaleString('ar-EG', { hour: 'numeric', minute: 'numeric' })}</td>
                  <td style={{ padding: '1.2rem' }}>
                    <span style={{ 
                      padding: '0.4rem 0.8rem', 
                      borderRadius: '8px', 
                      fontSize: '0.8rem',
                      background: row.status === 'confirmed' ? '#10b98115' : '#f59e0b15',
                      color: row.status === 'confirmed' ? '#10b981' : '#f59e0b'
                    }}>{row.status === 'confirmed' ? 'مؤكد' : 'قيد الانتظار'}</span>
                  </td>
                </tr>
              ))}
              {!loading && recentBookings.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
                    لا يوجد حجوزات حالية.. ابدأ بمشاركة رابط الواتساب!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
