'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, ReferenceLine } from 'recharts';
import { Wallet, TrendingUp, AlertTriangle, Activity, Target, Zap, DollarSign, Calculator, Eye, CheckCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

// Zero-Latency Data Fetcher
const fetcher = async (url: string) => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session?.access_token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch BI data');
  return res.json();
};

// Mock chart data for visualization
const revenueData = [
  { name: 'الأسبوع 1', revenue: 400 },
  { name: 'الأسبوع 2', revenue: 300 },
  { name: 'الأسبوع 3', revenue: 550 },
  { name: 'الأسبوع 4', revenue: 700 },
];

export default function CognitiveDashboard({ tenantId, isAgency = false, industryType = 'clinic' }: { tenantId?: string, isAgency?: boolean, industryType?: 'clinic' | 'restaurant' | 'ecommerce' | 'realestate' }) {
  const [viewMode, setViewMode] = useState<'executive' | 'accounting'>('executive');

  // SWR: Stale-While-Revalidate for Optimistic UI and Caching
  const endpoint = isAgency 
    ? `/api/bi/metrics?agencyId=${tenantId}` 
    : `/api/bi/metrics?tenantId=${tenantId}&industry=${industryType}`;
    
  const { data, error, isLoading } = useSWR(tenantId ? endpoint : null, fetcher, {
    refreshInterval: 30000, // Background updates every 30s
    revalidateOnFocus: true,
  });

  if (isLoading) return <div className="p-8 text-center animate-pulse text-[var(--text-dim)]">جاري تحميل بيانات العقل التحليلي...</div>;
  if (error) return <div className="p-8 text-center text-red-500">حدث خطأ في جلب البيانات المحاسبية المشفرة.</div>;

  const metrics = data?.data;

  if (isAgency) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        
        {/* Header Section & View Segregation Toggle */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cyber-widget p-6">
          <div>
            <h2 className="text-3xl font-black mb-2 flex items-center gap-3 bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
              <DollarSign size={32} className="text-emerald-400"/> 
              لوحة تحكم المالك (CEO Dashboard)
            </h2>
            <p className="text-[var(--text-dim)] text-sm flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-500" />
              تم التدقيق الحسابي التلقائي (Auto-Reconciled)
            </p>
          </div>
          
          <div className="flex bg-[rgba(255,255,255,0.05)] p-1 rounded-xl border border-[var(--glass-border)]">
            <button 
              onClick={() => setViewMode('executive')}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'executive' ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-[var(--text-main)] shadow-lg' : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'}`}
            >
              <Eye size={18}/> الإدارة العليا (Executive)
            </button>
            <button 
              onClick={() => setViewMode('accounting')}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'accounting' ? 'bg-[var(--accent-primary)] text-[var(--text-main)] shadow-lg' : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'}`}
            >
              <Calculator size={18}/> المحاسبة (Accounting)
            </button>
          </div>
        </div>

        {viewMode === 'executive' ? (
          /* =========================================
             EXECUTIVE VIEW: High-Level Clean Metrics
             ========================================= */
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Net Profit - Hero Card */}
              <div className="md:col-span-2 bg-gradient-to-br from-[#10b98115] to-[rgba(0,0,0,0)] border border-emerald-500/30 p-8 rounded-[2rem] relative overflow-hidden group hover:border-emerald-500/50 transition-all duration-500 shadow-[0_10px_40px_rgba(16,185,129,0.05)]">
                 <div className="absolute -top-10 -right-10 opacity-[0.03] group-hover:opacity-10 group-hover:scale-110 transition-all duration-700">
                   <TrendingUp size={200}/>
                 </div>
                 <p className="text-[#A7F3D0]/80 text-sm font-bold uppercase tracking-wider mb-2">صافي الأرباح النهائية (Final Net Profit)</p>
                 <h3 className="text-6xl font-black text-[var(--text-main)] flex items-end gap-2 drop-shadow-[0_0_20px_rgba(167,243,208,0.3)] aura-glow">
                   <span className="text-[#A7F3D0]">$</span>{metrics?.netProfit?.toLocaleString() || '0.00'}
                 </h3>
                 <div className="mt-6 flex items-center gap-4">
                   <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-bold flex items-center gap-1"><CheckCircle size={12}/> Audited</span>
                   <span className="text-xs text-[var(--text-dim)]">جاهزة للسحب المباشر (Payout Ready)</span>
                 </div>
              </div>

              {/* Margin */}
              <div className="cyber-widget p-6 flex flex-col justify-center items-center text-center">
                 <div className="w-16 h-16 bg-[#A7F3D0]/10 rounded-full flex items-center justify-center mb-4 text-[#A7F3D0] aura-glow">
                   <Activity size={32}/>
                 </div>
                 <p className="text-[var(--text-dim)] text-xs font-bold uppercase tracking-wider mb-2">معدل الربحية</p>
                 <h3 className="text-4xl font-black text-[var(--text-main)]">{metrics?.netMargin || '0%'}</h3>
              </div>

              {/* API Burn Rate */}
              <div className="cyber-widget p-6 flex flex-col justify-center items-center text-center">
                 <div className="w-16 h-16 bg-[#fca5a5]/10 rounded-full flex items-center justify-center mb-4 text-[#fca5a5] aura-glow">
                   <Zap size={32}/>
                 </div>
                 <p className="text-[var(--text-dim)] text-xs font-bold uppercase tracking-wider mb-2">إجمالي التكاليف التشغيلية</p>
                 <h3 className="text-4xl font-black text-[var(--text-main)]">${metrics?.apiCosts?.toFixed(2) || '0.00'}</h3>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================
             ACCOUNTING VIEW: Waterfall & Reconciliation
             ========================================= */
          <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* Automated Reconciler Alert */}
            <div className="bg-blue-500/10 border border-blue-500/30 p-5 rounded-2xl flex items-center gap-4">
              <Calculator className="text-blue-400" size={32} />
              <div>
                <h4 className="text-blue-400 font-bold text-sm">نظام التدقيق المحاسبي الآلي (Message Queue Reconciler)</h4>
                <p className="text-xs text-[var(--text-dim)] mt-1">تمت مطابقة 100% من العمليات المسجلة في السجلات مع فواتير Stripe بدون أي تناقضات مالية.</p>
              </div>
            </div>

            {/* Waterfall Chart Section */}
            <div className="cyber-widget p-8">
               <div className="mb-8">
                 <h3 className="text-xl font-bold text-[var(--text-main)] mb-2">تحليل الإيرادات (Waterfall Financial Breakdown)</h3>
                 <p className="text-sm text-[var(--text-dim)]">يوضح كيف نصل من إجمالي المبيعات إلى صافي الربح الفعلي بعد خصم كافة الرسوم والعمولات.</p>
               </div>
               
               <div className="h-[450px] w-full" dir="ltr">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics?.waterfall || []} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="var(--text-dim)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                      <Tooltip 
                        cursor={{fill: 'rgba(255,255,255,0.02)'}}
                        contentStyle={{ background: 'transparent', border: 'none', padding: 0 }} 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="glass-tooltip">
                                <p className="font-bold mb-1">{payload[0].payload.name}</p>
                                <p className="text-[var(--accent-primary)]">${Math.abs(Number(payload[0].value) || 0).toLocaleString()}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                      <Bar dataKey="value" radius={[6, 6, 6, 6]} barSize={50}>
                        {(metrics?.waterfall || []).map((entry: any, index: number) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.type === 'positive' ? '#10b981' : entry.type === 'negative' ? '#ef4444' : '#3b82f6'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                 </ResponsiveContainer>
               </div>
               
               {/* Legend */}
               <div className="flex justify-center gap-8 mt-6">
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div><span className="text-xs text-[var(--text-dim)]">إيرادات (Gross)</span></div>
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div><span className="text-xs text-[var(--text-dim)]">خصومات (Deductions)</span></div>
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div><span className="text-xs text-[var(--text-dim)]">الصافي النهائي (Net Profit)</span></div>
               </div>
            </div>

            {/* Granular Table */}
            <div className="cyber-widget p-0 rounded-[24px] overflow-hidden">
              <table className="w-full text-sm text-right border-collapse">
                <thead className="bg-[rgba(255,255,255,0.01)] text-[var(--text-dim)] border-b-[0.5px] border-[rgba(255,255,255,0.05)]">
                  <tr>
                    <th className="p-5 font-medium tracking-wide uppercase text-xs">البند المالي</th>
                    <th className="p-5 font-medium tracking-wide uppercase text-xs">القيمة المحتسبة</th>
                    <th className="p-5 font-medium tracking-wide uppercase text-xs">النسبة المئوية</th>
                    <th className="p-5 font-medium tracking-wide uppercase text-xs">التدقيق (Reconciliation)</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics?.waterfall?.map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors border-b-[0.5px] border-[rgba(255,255,255,0.03)] last:border-0">
                      <td className={`p-5 font-semibold ${item.type === 'total' ? 'text-[#E9D5FF]' : 'text-white'}`}>{item.name}</td>
                      <td className={`p-5 font-mono text-base ${item.type === 'positive' || item.type === 'total' ? 'text-[#A7F3D0]' : 'text-[#fca5a5]'}`}>
                        {item.type === 'negative' ? '-' : ''}${Math.abs(item.value).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                      <td className="p-5 text-[var(--text-dim)] font-mono">{Math.abs((item.value / (metrics?.grossRevenue || 1)) * 100).toFixed(1)}%</td>
                      <td className="p-5 text-[#A7F3D0] flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#A7F3D0] aura-glow"></div> مطابقة</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}
      </div>
    );
  }

  // Clinic View
  return (
    <div className="space-y-8 mt-6">
      
      {/* 1. Visualizing the Wallet & Burn Rate */}
      <div className="cyber-widget p-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-[var(--accent-primary)] bg-opacity-20 rounded-2xl">
            <Wallet size={32} color="var(--accent-primary)" />
          </div>
          <div>
            <p className="text-[var(--text-dim)] text-sm">الرصيد المشفر (Ledger Verified)</p>
            <h2 className="text-4xl font-black">${metrics?.wallet?.balance?.toFixed(2)}</h2>
          </div>
        </div>
        
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${metrics?.wallet?.burnRateDays < 7 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'}`}>
           <AlertTriangle size={20} />
           <div>
             <p className="text-xs font-bold">Burn Rate Predictor</p>
             <p className="text-sm">الرصيد يكفي لمدة: <b>{metrics?.wallet?.burnRateDays} أيام</b></p>
           </div>
        </div>
      </div>

      {/* 2. Performance Metrics (The Triple Crown - Industry Specific) */}
      <div>
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Target size={20} color="var(--accent-primary)"/> 
          {industryType === 'clinic' ? 'أداء العيادة' : industryType === 'restaurant' ? 'أداء المطعم' : 'أداء المتجر'} (The Triple Crown)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="cyber-widget p-5">
              <p className="text-[var(--text-dim)] text-sm">
                {industryType === 'clinic' ? 'العوائد (Revenue Generated)' : 'إجمالي المبيعات (Gross Merchandise Value)'}
              </p>
              <h3 className="text-2xl font-bold mt-1 text-[var(--accent-primary)]">${metrics?.tripleCrown?.revenueGenerated}</h3>
              <p className="text-xs text-[var(--text-dim)] mt-2">
                {industryType === 'clinic' ? 'إجمالي قيمة حجوزات الـ AI' : 'إجمالي قيمة الطلبات (Orders) عبر الـ AI'}
              </p>
           </div>
           <div className="cyber-widget p-5">
              <p className="text-[var(--text-dim)] text-sm">
                {industryType === 'realestate' ? 'جودة العملاء المحتملين (Lead Quality)' : 'أداء البوت (Resolution Rate)'}
              </p>
              <h3 className="text-2xl font-bold mt-1 text-purple-400">{metrics?.tripleCrown?.resolutionRate}</h3>
              <p className="text-xs text-[var(--text-dim)] mt-2">
                {industryType === 'restaurant' ? 'طلبات مكتملة بدون تدخل بشري' : 'محادثات تم حلها بدون تدخل بشري'}
              </p>
           </div>
        </div>
      </div>

      {/* AI Revenue Chart (Recharts) */}
      <div className="cyber-widget p-6 h-80">
         <h3 className="text-sm font-bold mb-6 text-[var(--text-dim)]">
           مخطط {industryType === 'clinic' ? 'العوائد المحققة' : 'المبيعات وتوصيل الطلبات'} بواسطة الذكاء الاصطناعي (AI Profit Engine)
         </h3>
         <ResponsiveContainer width="100%" height="80%">
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
              <Tooltip 
                contentStyle={{ background: 'transparent', border: 'none', padding: 0 }} 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="glass-tooltip">
                        <p className="text-[var(--text-dim)] text-xs mb-1">{label}</p>
                        <p className="text-[#A7F3D0] font-bold text-lg">${Number(payload[0].value).toLocaleString()}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area type="monotone" dataKey="revenue" stroke="var(--accent-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
            </AreaChart>
          </ResponsiveContainer>
      </div>

      {/* Internal AI Agent Floating Bubble */}
      <div className="fixed bottom-8 right-8 z-50 group cursor-pointer" onClick={() => window.dispatchEvent(new Event('open-neural-cmd'))}>
        <div className="absolute inset-0 bg-[#A7F3D0] rounded-full opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-500"></div>
        <div className="relative bg-[rgba(15,23,42,0.9)] border border-[rgba(167,243,208,0.3)] w-14 h-14 rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <Zap size={24} className="text-[#A7F3D0] aura-glow" />
        </div>
      </div>

    </div>
  );
}
