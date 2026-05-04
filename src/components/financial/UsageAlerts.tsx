import React from 'react';
import { AlertCircle, Zap } from 'lucide-react';

export default function UsageAlerts({ role, data }: { role: string, data: any }) {
  if (!data) return null;

  const alerts = [];

  if (role === 'admin' && data.tenant) {
    const t = data.tenant;
    if (t.plan_type !== 'vip') {
      const msgPct = (t.messages_used / (t.messages_limit || 1)) * 100;
      const voicePct = (t.voice_minutes_used / (t.voice_minutes_limit || 1)) * 100;

      if (msgPct >= 95 || voicePct >= 95) {
        alerts.push({ type: 'danger', msg: 'لقد استهلكت أكثر من 95% من باقتك. يرجى الترقية لتجنب توقف الخدمة!', upgrade: true });
      } else if (msgPct >= 80 || voicePct >= 80) {
        alerts.push({ type: 'warning', msg: 'لقد قاربت على استهلاك باقتك (تجاوزت 80%).' });
      }
    }
  } else if (role === 'super_admin' && data.tenants) {
    const nearingLimit = data.tenants.filter((t: any) => t.plan_type !== 'vip' && ((t.messages_used / (t.messages_limit || 1)) * 100 >= 80));
    if (nearingLimit.length > 0) {
      alerts.push({ type: 'warning', msg: `يوجد ${nearingLimit.length} عملاء قاربوا على استهلاك باقاتهم.` });
    }
  } else if (role === 'master_admin' && data.agencies) {
    const nearingLimit = data.agencies.filter((a: any) => a.plan_type !== 'vip' && ((a.messages_used / (a.messages_limit || 1)) * 100 >= 95));
    if (nearingLimit.length > 0) {
      alerts.push({ type: 'danger', msg: `يوجد ${nearingLimit.length} وكالات تجاوزت 95% من استهلاكها.` });
    }
  }

  if (alerts.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
      {alerts.map((alert, i) => (
        <div key={i} style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '1.2rem', 
          borderRadius: '16px', 
          background: alert.type === 'danger' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
          border: `1px solid ${alert.type === 'danger' ? '#ef4444' : '#f59e0b'}`,
          color: alert.type === 'danger' ? '#fca5a5' : '#fcd34d'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <AlertCircle size={20} />
            <span style={{ fontWeight: 600 }}>{alert.msg}</span>
          </div>
          {alert.upgrade && (
            <button style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Zap size={16} /> رفع الباقة
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
