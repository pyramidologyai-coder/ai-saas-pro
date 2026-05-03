'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import FinancialKPIs from '@/components/financial/FinancialKPIs';
import AgencyTable from '@/components/financial/AgencyTable';
import { getFinancialDashboardData } from '@/lib/financial';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { ShieldAlert, AlertTriangle, CheckCircle, Wallet, CreditCard } from 'lucide-react';

export default function FinancialDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMaster, setIsMaster] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.href = '/auth';
          return;
        }

        const userEmail = session.user.email;
        const superAdminEmails = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
        const isMasterUser = !!userEmail && superAdminEmails.includes(userEmail);
        
        setIsMaster(isMasterUser);

        if (isMasterUser) {
          const financialData = await getFinancialDashboardData();
          setData(financialData);
        }
      } catch (err) {
        console.error('Failed to load financial data', err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-main)' }}>جاري تحميل البيانات المالية...</div>;
  }

  if (!isMaster) {
    return (
      <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-main)' }}>
        <ShieldAlert size={64} color="#ef4444" style={{ margin: '0 auto 1rem auto' }} />
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>غير مصرح بالدخول</h1>
        <p style={{ color: 'var(--text-dim)' }}>هذه الصفحة مخصصة للإدارة العليا (Master Admin) فقط.</p>
      </div>
    );
  }

  if (!data) return null;

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'USD' }).format(value);
  };

  return (
    <div style={{ padding: '2rem', color: 'var(--text-main)', direction: 'rtl' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
          اللوحة المالية للإدارة (Master Admin)
        </h1>
        <p style={{ color: 'var(--text-dim)' }}>نظرة شاملة على أرباح المنصة، أداء الوكالات، واشتراكات العملاء المباشرين.</p>
      </div>

      {/* Smart Alerts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {data.alerts.map((alert: any, idx: number) => (
          <div key={idx} style={{
            background: alert.type === 'danger' ? 'rgba(239, 68, 68, 0.1)' : alert.type === 'warning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            border: `1px solid ${alert.type === 'danger' ? '#ef4444' : alert.type === 'warning' ? '#f59e0b' : '#10b981'}`,
            padding: '1rem 1.5rem',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            color: alert.type === 'danger' ? '#ef4444' : alert.type === 'warning' ? '#f59e0b' : '#10b981'
          }}>
            {alert.type === 'danger' ? <AlertTriangle size={24} /> : alert.type === 'warning' ? <ShieldAlert size={24} /> : <CheckCircle size={24} />}
            <span style={{ fontWeight: 600 }}>{alert.message}</span>
          </div>
        ))}
      </div>

      {/* KPI Cards */}
      <FinancialKPIs data={data.kpis} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        {/* Revenue Sources Table */}
        <div style={{ background: 'var(--card-bg)', borderRadius: '24px', border: '1px solid var(--glass-border)', padding: '2rem' }}>
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
            <Wallet size={24} color="#10b981" />
            مصادر الإيرادات
          </h2>
          <div style={{ marginBottom: '1.5rem', height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.revenueSources} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} stroke="none">
                  {data.revenueSources.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {data.revenueSources.map((source: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: COLORS[i % COLORS.length] }}></div>
                    {source.name}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold' }} dir="ltr">{formatCurrency(source.value)}</td>
                  <td style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-dim)' }}>
                    {data.kpis.totalRevenue > 0 ? ((source.value / data.kpis.totalRevenue) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Costs Table */}
        <div style={{ background: 'var(--card-bg)', borderRadius: '24px', border: '1px solid var(--glass-border)', padding: '2rem' }}>
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
            <CreditCard size={24} color="#ef4444" />
            التكاليف الشهرية
          </h2>
          <div style={{ marginBottom: '1.5rem', height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.costs}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: any) => formatCurrency(Number(value))} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {data.costs.map((cost: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1rem' }}>{cost.name}</td>
                  <td style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold' }} dir="ltr">{formatCurrency(cost.value)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: '1rem', fontWeight: 'bold', color: '#ef4444' }}>إجمالي التكاليف</td>
                <td style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', color: '#ef4444' }} dir="ltr">
                  {formatCurrency(data.costs.reduce((acc: number, curr: any) => acc + curr.value, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Agency Performance Table */}
      <AgencyTable agencies={data.agencyPerformance} />

    </div>
  );
}
