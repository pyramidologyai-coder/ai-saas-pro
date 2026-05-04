import React from 'react';
import UsageProgressBar from './UsageProgressBar';

export default function AgencyTable({ data }: { data: any }) {
  if (!data?.agencies) return null;

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '24px', border: '1px solid var(--glass-border)', padding: '2rem', marginTop: '2rem', overflowX: 'auto' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>بيانات الوكالات والعمولات</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
        <thead>
          <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)' }}>
            <th style={{ padding: '1rem' }}>الوكالة</th>
            <th style={{ padding: '1rem' }}>إيرادها</th>
            <th style={{ padding: '1rem' }}>نسبة العمولة</th>
            <th style={{ padding: '1rem' }}>قيمة العمولة</th>
            <th style={{ padding: '1rem', width: '30%' }}>الاستهلاك (الرسائل والصوت)</th>
          </tr>
        </thead>
        <tbody>
          {data.agencies.map((agency: any, i: number) => {
            const revenue = agency.revenue || 0;
            const rate = agency.commission_rate || 20; 
            const commission = (revenue * rate) / 100;
            const isUnlimited = agency.plan_type === 'vip';

            return (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '1.2rem', fontWeight: 600 }}>{agency.name || `وكالة ${agency.id?.substring(0,6) || ''}`}</td>
                <td style={{ padding: '1.2rem' }}>${revenue.toLocaleString()}</td>
                <td style={{ padding: '1.2rem', color: '#10b981' }}>{rate}%</td>
                <td style={{ padding: '1.2rem', fontWeight: 700 }}>${commission.toLocaleString()}</td>
                <td style={{ padding: '1.2rem' }}>
                  <UsageProgressBar used={agency.messages_used || 0} limit={agency.messages_limit || 1000} label="الرسائل" isUnlimited={isUnlimited} />
                  <UsageProgressBar used={agency.voice_minutes_used || 0} limit={agency.voice_minutes_limit || 60} label="الصوت (دقائق)" isUnlimited={isUnlimited} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
