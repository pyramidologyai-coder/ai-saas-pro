import React from 'react';
import UsageProgressBar from './UsageProgressBar';

export default function ClientsTable({ data }: { data: any }) {
  if (!data?.tenants) return null;

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '24px', border: '1px solid var(--glass-border)', padding: '2rem', marginTop: '2rem', overflowX: 'auto' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>عملاء الوكالة</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
        <thead>
          <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)' }}>
            <th style={{ padding: '1rem' }}>العميل</th>
            <th style={{ padding: '1rem' }}>الباقة</th>
            <th style={{ padding: '1rem' }}>الإيراد</th>
            <th style={{ padding: '1rem' }}>انتهاء الاشتراك</th>
            <th style={{ padding: '1rem', width: '30%' }}>الاستهلاك (الرسائل والصوت)</th>
          </tr>
        </thead>
        <tbody>
          {data.tenants.map((t: any, i: number) => {
            const isUnlimited = t.plan_type === 'vip';
            return (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '1.2rem', fontWeight: 600 }}>{t.name}</td>
                <td style={{ padding: '1.2rem' }}>
                  <span style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', fontSize: '0.8rem' }}>
                    {t.plan_type?.toUpperCase() || 'STARTER'}
                  </span>
                </td>
                <td style={{ padding: '1.2rem' }}>${(t.revenue || 0).toLocaleString()}</td>
                <td style={{ padding: '1.2rem', fontSize: '0.9rem' }}>{t.subscription_end_date ? new Date(t.subscription_end_date).toLocaleDateString('ar-EG') : 'غير محدد'}</td>
                <td style={{ padding: '1.2rem' }}>
                  <UsageProgressBar used={t.messages_used || 0} limit={t.messages_limit || 1000} label="الرسائل" isUnlimited={isUnlimited} />
                  <UsageProgressBar used={t.voice_minutes_used || 0} limit={t.voice_minutes_limit || 60} label="الصوت (دقائق)" isUnlimited={isUnlimited} />
                </td>
              </tr>
            );
          })}
          {data.tenants.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>لا يوجد عملاء مضافين حتى الآن</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
