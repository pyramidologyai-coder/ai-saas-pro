import React from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Building2, 
  Users, 
  MessageCircle, 
  Percent 
} from 'lucide-react';

interface KPIProps {
  data: {
    totalRevenue: number;
    netProfit: number;
    activeAgenciesCount: number;
    totalClients: number;
    todayAiMessages: number;
    profitMargin: number;
  };
}

export default function FinancialKPIs({ data }: KPIProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'USD' }).format(value);
  };

  const kpis = [
    { label: 'إجمالي الإيرادات الشهرية', value: formatCurrency(data.totalRevenue), icon: DollarSign, color: '#10b981' },
    { label: 'صافي الربح', value: formatCurrency(data.netProfit), icon: TrendingUp, color: '#6366f1' },
    { label: 'وكالات نشطة', value: data.activeAgenciesCount.toString(), icon: Building2, color: '#f59e0b' },
    { label: 'إجمالي العملاء', value: data.totalClients.toString(), icon: Users, color: '#3b82f6' },
    { label: 'رسائل AI اليوم', value: data.todayAiMessages.toLocaleString('ar-EG'), icon: MessageCircle, color: '#a855f7' },
    { label: 'هامش الربح', value: `${data.profitMargin.toFixed(1)}%`, icon: Percent, color: '#ec4899' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
      {kpis.map((kpi, i) => (
        <div key={i} style={{
          background: 'var(--card-bg)',
          padding: '1.5rem',
          borderRadius: '24px',
          border: '1px solid var(--glass-border)',
          transition: 'transform 0.2s',
          cursor: 'default',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: `${kpi.color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: kpi.color
            }}>
              <kpi.icon size={24} />
            </div>
          </div>
          <h3 style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{kpi.label}</h3>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }} dir="ltr">
            {kpi.value}
          </div>
        </div>
      ))}
    </div>
  );
}
