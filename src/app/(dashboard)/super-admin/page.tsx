'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, 
  Building2, 
  CreditCard, 
  Activity, 
  Plus, 
  Search, 
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Zap
} from 'lucide-react';

const SuperAdminDashboard = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalTenants: 0,
    activeSubscriptions: 0,
    totalBookings: 0,
    systemHealth: '100%'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: tenantsData } = await supabase.from('tenants').select('*');
      const { count: bookingsCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true });

      setTenants(tenantsData || []);
      setStats({
        totalTenants: tenantsData?.length || 0,
        activeSubscriptions: tenantsData?.filter(t => t.subscription_tier !== 'expired').length || 0,
        totalBookings: bookingsCount || 0,
        systemHealth: '99.9%'
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', color: 'var(--text-main)' }}>
      {/* Header section with Stats */}
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '0.5rem', background: 'linear-gradient(to right, #fff, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Super Admin Control Panel
        </h1>
        <p style={{ color: 'var(--text-dim)' }}>إدارة المنصة الشاملة ومتابعة الـ 1000 عيادة والمطاعم.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        {[
          { label: 'إجمالي المشتركين', value: stats.totalTenants, icon: Building2, color: '#6366f1' },
          { label: 'اشتراكات نشطة', value: stats.activeSubscriptions, icon: ShieldCheck, color: '#10b981' },
          { label: 'إجمالي عمليات الـ AI', value: stats.totalBookings, icon: Activity, color: '#a855f7' },
          { label: 'سلامة النظام', value: stats.systemHealth, icon: Zap, color: '#f59e0b' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--glass-border)', backdropFilter: 'blur(10px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <s.icon color={s.color} size={24} />
              <div style={{ fontSize: '0.7rem', background: `${s.color}20`, color: s.color, padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: '700' }}>LIVE</div>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '0.2rem' }}>{s.value}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div style={{ background: 'var(--card-bg)', borderRadius: '28px', border: '1px solid var(--glass-border)', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2>إدارة العيادات والمطاعم</h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.6rem 1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <Search size={18} color="var(--text-dim)" />
              <input type="text" placeholder="بحث عن عيادة..." style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', fontSize: '0.9rem' }} />
            </div>
            <button style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Plus size={18} /> إضافة عميل يدوي
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)', fontSize: '0.9rem' }}>
                <th style={{ textAlign: 'right', padding: '1rem' }}>المؤسسة</th>
                <th style={{ textAlign: 'right', padding: '1rem' }}>النوع</th>
                <th style={{ textAlign: 'right', padding: '1rem' }}>الباقة</th>
                <th style={{ textAlign: 'right', padding: '1rem' }}>تاريخ التسجيل</th>
                <th style={{ textAlign: 'center', padding: '1rem' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: '0.2s' }}>
                  <td style={{ padding: '1.2rem' }}>
                    <div style={{ fontWeight: '600' }}>{t.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{t.slug}.aisaas.pro</div>
                  </td>
                  <td style={{ padding: '1.2rem' }}>
                    <span style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
                      {t.type === 'clinic' ? '🏥 عيادة' : '🍔 مطعم'}
                    </span>
                  </td>
                  <td style={{ padding: '1.2rem' }}>
                    <span style={{ 
                      fontSize: '0.8rem', 
                      padding: '0.3rem 0.7rem', 
                      borderRadius: '8px', 
                      background: t.subscription_tier === 'pro' ? '#6366f120' : '#94a3b820',
                      color: t.subscription_tier === 'pro' ? '#6366f1' : '#94a3b8',
                      fontWeight: '700'
                    }}>
                      {t.subscription_tier?.toUpperCase() || 'BASIC'}
                    </span>
                  </td>
                  <td style={{ padding: '1.2rem', fontSize: '0.85rem' }}>{new Date(t.created_at).toLocaleDateString('ar-EG')}</td>
                  <td style={{ padding: '1.2rem', textAlign: 'center' }}>
                    <button style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                      <ExternalLink size={14} /> دخول
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
