import React from 'react';
import { DollarSign, Briefcase, Users, Building2, Calendar, Target } from 'lucide-react';

export default function FinancialKPIs({ role, data }: { role: string, data: any }) {
  if (!data) return null;

  if (role === 'master_admin') {
    const totalAgencyRev = data.agencies?.reduce((acc: any, a: any) => acc + (a.revenue || 0), 0) || 0;
    const totalTenants = data.tenants?.length || 0;
    
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <KPICard label="إجمالي إيرادات الوكالات" value={`$${totalAgencyRev.toLocaleString()}`} icon={DollarSign} color="#10b981" />
        <KPICard label="صافي الربح" value={`$${(totalAgencyRev * 0.8).toLocaleString()}`} icon={Target} color="#6366f1" />
        <KPICard label="الوكالات النشطة" value={data.agencies?.length || 0} icon={Briefcase} color="#f59e0b" />
        <KPICard label="إجمالي العملاء" value={totalTenants} icon={Users} color="#a855f7" />
      </div>
    );
  }

  if (role === 'super_admin') {
    const totalRevenue = data.tenants?.reduce((acc: any, t: any) => acc + (t.revenue || 0), 0) || 0;
    const masterCommission = totalRevenue * 0.20; 
    
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <KPICard label="إيرادات وكالتك" value={`$${totalRevenue.toLocaleString()}`} icon={DollarSign} color="#10b981" />
        <KPICard label="رسوم المنصة (Master)" value={`$${masterCommission.toLocaleString()}`} icon={Target} color="#ef4444" />
        <KPICard label="عملائك" value={data.tenants?.length || 0} icon={Building2} color="#6366f1" />
        <KPICard label="رسائل مستهلكة (اليوم)" value={data.agency?.messages_used || 0} icon={Users} color="#a855f7" />
      </div>
    );
  }

  if (role === 'admin') {
    const planName = data.tenant?.plan_type?.toUpperCase() || 'STARTER';
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <KPICard label="الباقة الحالية" value={planName} icon={Target} color="#6366f1" />
        <KPICard label="الرسائل المستهلكة" value={`${data.tenant?.messages_used || 0} رسالة`} icon={Users} color="#10b981" />
        <KPICard label="دقائق الصوت المستهلكة" value={`${data.tenant?.voice_minutes_used || 0} دقيقة`} icon={Briefcase} color="#f59e0b" />
        <KPICard label="انتهاء الاشتراك" value={data.tenant?.subscription_end_date ? new Date(data.tenant.subscription_end_date).toLocaleDateString('ar-EG') : 'غير محدد'} icon={Calendar} color="#ef4444" />
      </div>
    );
  }

  return null;
}

function KPICard({ label, value, icon: Icon, color }: any) {
  return (
    <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <Icon color={color} size={24} />
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '0.2rem' }}>{value}</div>
      <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{label}</div>
    </div>
  );
}
