import React from 'react';
import UsageProgressBar from './UsageProgressBar';

export default function AdminUsageView({ data }: { data: any }) {
  if (!data?.tenant) return null;
  const t = data.tenant;
  const isUnlimited = t.plan_type === 'vip';

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '24px', border: '1px solid var(--glass-border)', padding: '2rem', marginTop: '2rem' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>تفاصيل الاستهلاك الحالي</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <UsageProgressBar used={t.messages_used || 0} limit={t.messages_limit || 1000} label="رسائل الواتساب والتفاعل الآلي" isUnlimited={isUnlimited} />
        <UsageProgressBar used={t.voice_minutes_used || 0} limit={t.voice_minutes_limit || 60} label="دقائق الذكاء الاصطناعي الصوتي (AI Voice)" isUnlimited={isUnlimited} />
      </div>
    </div>
  );
}
