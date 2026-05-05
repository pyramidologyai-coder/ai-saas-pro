import React from 'react';

export default function RevenueSourcesTable({ data }: { data: any }) {
  if (!data?.agencies || !data?.tenants) return null;

  // 1. إيرادات الباقات (العملاء المباشرين بدون وكالة)
  const directTenants = data.tenants.filter((t: any) => !t.agency_id);
  const plansRevenue = directTenants.reduce((sum: number, t: any) => sum + (t.revenue || 0), 0);

  // 2. إيرادات العمولات (من الوكالات)
  const commissionRevenue = data.agencies.reduce((sum: number, a: any) => {
    const rev = a.revenue || 0;
    const rate = a.commission_rate || 20;
    return sum + (rev * rate) / 100;
  }, 0);

  const totalRevenue = plansRevenue + commissionRevenue;

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '24px', border: '1px solid var(--glass-border)', padding: '2rem', marginTop: '2rem', overflowX: 'auto' }}>
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-main)' }}>مصادر الإيرادات (Revenue Sources)</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
        <thead>
          <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)' }}>
            <th style={{ padding: '1rem' }}>المصدر</th>
            <th style={{ padding: '1rem' }}>النسبة من الإجمالي</th>
            <th style={{ padding: '1rem' }}>القيمة</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <td style={{ padding: '1.2rem', fontWeight: 600 }}>إيرادات الاشتراكات المباشرة (الباقات)</td>
            <td style={{ padding: '1.2rem', color: '#6366f1' }}>{totalRevenue > 0 ? ((plansRevenue / totalRevenue) * 100).toFixed(1) : 0}%</td>
            <td style={{ padding: '1.2rem', fontWeight: 700, color: '#6366f1' }}>${plansRevenue.toLocaleString()}</td>
          </tr>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <td style={{ padding: '1.2rem', fontWeight: 600 }}>إيرادات العمولات (من الوكالات)</td>
            <td style={{ padding: '1.2rem', color: '#10b981' }}>{totalRevenue > 0 ? ((commissionRevenue / totalRevenue) * 100).toFixed(1) : 0}%</td>
            <td style={{ padding: '1.2rem', fontWeight: 700, color: '#10b981' }}>${commissionRevenue.toLocaleString()}</td>
          </tr>
          <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
            <td style={{ padding: '1.2rem', fontWeight: 800, color: 'var(--accent-primary)' }}>إجمالي إيرادات المنصة</td>
            <td style={{ padding: '1.2rem' }}>100%</td>
            <td style={{ padding: '1.2rem', fontWeight: 900, color: 'var(--accent-primary)', fontSize: '1.2rem' }}>${totalRevenue.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
