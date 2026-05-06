'use client';
import React from 'react';
import { 
  DollarSign, 
  Building2, 
  Users, 
  MessageCircle,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Minus
} from 'lucide-react';

interface RecentAgency {
  readonly id: string;
  readonly name: string;
  readonly plan_type: 'starter' | 'growth' | 'pro' | 'vip';
  readonly status: 'active' | 'inactive' | 'suspended' | 'pending' | 'unpaid';
  readonly created_at: string;
  readonly tenants_count: number;
}

interface MasterDashboardUIProps {
  agenciesCount: number;
  tenantsCount: number;
  totalMessagesToday: number;
  expiringCount: number;
  highUsageCount: number;
  recentAgencies: readonly RecentAgency[];
  totalRevenue: number;
  agenciesGrowth: number;
  usageRate: number;
}

export function MasterDashboardUI({
  agenciesCount,
  tenantsCount,
  totalMessagesToday,
  expiringCount,
  highUsageCount,
  recentAgencies,
  totalRevenue,
  agenciesGrowth,
  usageRate
}: MasterDashboardUIProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', direction: 'rtl' }}>
      
      {/* Smart Banners */}
      {(expiringCount > 0 || highUsageCount > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {expiringCount > 0 && (
            <div style={{ 
              background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.1), transparent)', 
              border: '1px solid rgba(245, 158, 11, 0.3)',
              padding: '1rem',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              color: '#f59e0b'
            }}>
              <AlertTriangle size={24} />
              <span style={{ fontWeight: 600 }}>⚠️ {expiringCount} وكالات اشتراكها ينتهي خلال 7 أيام</span>
            </div>
          )}

          {highUsageCount > 0 && (
            <div style={{ 
              background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.1), transparent)', 
              border: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '1rem',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              color: '#ef4444'
            }}>
              <AlertTriangle size={24} />
              <span style={{ fontWeight: 600 }}>🔴 {highUsageCount} عملاء وصلوا 80% من رصيد رسائلهم</span>
            </div>
          )}
        </div>
      )}

      {/* 4 Core KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
        {[
          { label: 'إجمالي الإيرادات', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: '#10b981' },
          { label: 'الوكالات النشطة', value: agenciesCount.toLocaleString(), icon: Building2, color: '#3b82f6' },
          { label: 'إجمالي العملاء', value: tenantsCount.toLocaleString(), icon: Users, color: '#8b5cf6' },
          { label: 'رسائل اليوم', value: totalMessagesToday.toLocaleString(), icon: MessageCircle, color: '#06b6d4' }
        ].map((kpi, i) => (
          <div key={i} style={{ 
            background: 'var(--card-bg)', 
            padding: '1.5rem', 
            borderRadius: '24px', 
            border: '1px solid var(--glass-border)' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ background: `${kpi.color}15`, color: kpi.color, padding: '0.5rem', borderRadius: '12px' }}>
                <kpi.icon size={24} />
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
              {kpi.value}
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* 4 Secondary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
        
        {/* Agency Growth */}
        <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>نمو الوكالات (شهري)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800 }}>{agenciesGrowth}%</span>
            {agenciesGrowth > 0 ? <TrendingUp color="#10b981" /> : agenciesGrowth < 0 ? <TrendingDown color="#ef4444" /> : <Minus color="#6b7280" />}
          </div>
        </div>

        {/* Usage Rate */}
        <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>معدل الاستخدام العام</span>
            <span style={{ fontWeight: 'bold' }}>{usageRate}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ 
              width: `${usageRate}%`, 
              height: '100%', 
              background: usageRate > 80 ? '#ef4444' : usageRate > 60 ? '#f59e0b' : '#10b981',
              borderRadius: '10px'
            }}></div>
          </div>
        </div>

        {/* Expiring Count */}
        <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>وكالات تنتهي قريباً</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: expiringCount > 0 ? '#ef4444' : 'var(--text-main)' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800 }}>{expiringCount}</span>
            {expiringCount > 0 && <AlertTriangle size={20} />}
          </div>
        </div>

        {/* High Usage Count */}
        <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>عملاء تخطوا 80%</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: highUsageCount > 0 ? '#f59e0b' : 'var(--text-main)' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800 }}>{highUsageCount}</span>
            {highUsageCount > 0 && <AlertTriangle size={20} />}
          </div>
        </div>

      </div>

      {/* Recent Agencies Table */}
      <section style={{ 
        background: 'var(--card-bg)', 
        borderRadius: '24px', 
        padding: '2rem', 
        border: '1px solid var(--glass-border)' 
      }}>
        <h2 style={{ marginBottom: '1.5rem' }}>أحدث الوكالات المنضمة</h2>
        
        {recentAgencies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
            <Building2 size={48} color="rgba(255,255,255,0.1)" style={{ margin: '0 auto 1rem auto' }} />
            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>لا توجد وكالات مسجلة حتى الآن</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ padding: '1rem' }}>اسم الوكالة</th>
                  <th style={{ padding: '1rem' }}>الباقة</th>
                  <th style={{ padding: '1rem' }}>عدد العملاء</th>
                  <th style={{ padding: '1rem' }}>الحالة</th>
                  <th style={{ padding: '1rem' }}>تاريخ الانضمام</th>
                </tr>
              </thead>
              <tbody>
                {recentAgencies.map((agency) => (
                  <tr key={agency.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1.2rem', fontWeight: 600 }}>{agency.name}</td>
                    <td style={{ padding: '1.2rem' }}>
                      <span style={{
                        padding: '0.3rem 0.8rem',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        background: agency.plan_type === 'vip' ? '#eab30820' : agency.plan_type === 'pro' ? '#a855f720' : agency.plan_type === 'growth' ? '#3b82f620' : '#6b728020',
                        color: agency.plan_type === 'vip' ? '#eab308' : agency.plan_type === 'pro' ? '#a855f7' : agency.plan_type === 'growth' ? '#3b82f6' : '#9ca3af'
                      }}>
                        {agency.plan_type.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '1.2rem' }}>{agency.tenants_count}</td>
                    <td style={{ padding: '1.2rem' }}>
                      <span style={{
                        padding: '0.3rem 0.8rem',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        background: agency.status === 'active' ? '#10b98120' : agency.status === 'suspended' ? '#ef444420' : (agency.status === 'pending' || agency.status === 'unpaid') ? '#f59e0b20' : '#6b728020',
                        color: agency.status === 'active' ? '#10b981' : agency.status === 'suspended' ? '#ef4444' : (agency.status === 'pending' || agency.status === 'unpaid') ? '#f59e0b' : '#9ca3af'
                      }}>
                        {agency.status === 'active' ? 'نشط' : agency.status === 'suspended' ? 'موقوف' : (agency.status === 'pending' || agency.status === 'unpaid') ? 'بانتظار الدفع' : 'غير محدد'}
                      </span>
                    </td>
                    <td style={{ padding: '1.2rem', fontSize: '0.9rem', color: 'var(--text-dim)' }}>
                      {new Date(agency.created_at).toLocaleDateString('ar-EG')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  );
}
