'use client';

import React from 'react';
import useSWR from 'swr';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Wallet, TrendingUp, AlertTriangle, Activity, Target, Zap, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Zero-Latency Data Fetcher
const fetcher = async (url: string) => {
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
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-black mb-1 flex items-center gap-3 bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
              <DollarSign size={32} className="text-emerald-400"/> 
              لوحة أرباح الوكيل المعتمد (Master Dashboard)
            </h2>
            <p className="text-[var(--text-dim)] text-sm">نظرة شاملة على أداء الوكالة، التدفقات النقدية، والاستهلاك اللحظي للذكاء الاصطناعي.</p>
          </div>
          <div className="px-5 py-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            حالة الوكالة: نشط (Active)
          </div>
        </div>

        {/* Premium KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          
          {/* Net Profit - Hero Card */}
          <div className="md:col-span-2 bg-gradient-to-br from-[#10b98115] to-[rgba(0,0,0,0)] border border-emerald-500/30 p-8 rounded-[2rem] relative overflow-hidden group hover:border-emerald-500/50 transition-all duration-500">
             <div className="absolute -top-10 -right-10 opacity-[0.03] group-hover:opacity-10 group-hover:scale-110 transition-all duration-700">
               <TrendingUp size={200}/>
             </div>
             <p className="text-emerald-400/80 text-sm font-bold uppercase tracking-wider mb-2">صافي الأرباح (Net Profit)</p>
             <h3 className="text-6xl font-black text-white flex items-end gap-2 drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]">
               <span className="text-emerald-500">$</span>{metrics?.netProfit?.toLocaleString() || '1,250.00'}
             </h3>
             <div className="mt-6 flex items-center gap-4">
               <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold">+24.5% هذا الشهر</span>
               <span className="text-xs text-[var(--text-dim)]">بعد خصم التكاليف التشغيلية</span>
             </div>
          </div>

          {/* Margin */}
          <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] p-6 rounded-[2rem] relative overflow-hidden group hover:bg-[rgba(255,255,255,0.02)] transition-all">
             <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-4 text-cyan-400">
               <Activity size={24}/>
             </div>
             <p className="text-[var(--text-dim)] text-xs font-bold uppercase tracking-wider mb-1">هامش الربح (Margin)</p>
             <h3 className="text-3xl font-black text-white mb-2">{metrics?.netMargin || '96.4%'}</h3>
             <p className="text-xs text-[var(--text-dim)] leading-relaxed">أعلى هامش ربحي بفضل بنية الـ Edge Computing.</p>
          </div>

          {/* API Costs */}
          <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] p-6 rounded-[2rem] relative overflow-hidden group hover:bg-[rgba(255,255,255,0.02)] transition-all">
             <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center mb-4 text-rose-400">
               <Zap size={24}/>
             </div>
             <p className="text-[var(--text-dim)] text-xs font-bold uppercase tracking-wider mb-1">تكلفة الـ APIs</p>
             <h3 className="text-3xl font-black text-white mb-2">${metrics?.apiCosts?.toFixed(2) || '45.00'}</h3>
             <p className="text-xs text-[var(--text-dim)] leading-relaxed">استهلاك (OpenAI/Anthropic/Meta).</p>
          </div>
        </div>

        {/* Agency Growth Chart */}
        <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] p-8 rounded-[2rem] h-[400px]">
           <div className="flex justify-between items-end mb-8">
             <div>
               <h3 className="text-lg font-bold text-white mb-1">منحنى نمو إيرادات الوكالة (Agency Growth)</h3>
               <p className="text-sm text-[var(--text-dim)]">مقارنة العوائد بالتكاليف التشغيلية عبر الأسابيع الأربعة الماضية.</p>
             </div>
             <div className="flex gap-4">
               <div className="flex items-center gap-2 text-xs text-[var(--text-dim)]"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> الأرباح</div>
             </div>
           </div>
           <ResponsiveContainer width="100%" height="80%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} dx={-10} />
                <Tooltip 
                  contentStyle={{ background: 'rgba(10,10,10,0.95)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} 
                  itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // Clinic View
  return (
    <div className="space-y-8 mt-6">
      
      {/* 1. Visualizing the Wallet & Burn Rate */}
      <div className="bg-gradient-to-r from-[rgba(255,255,255,0.05)] to-[rgba(255,255,255,0.01)] border border-[var(--glass-border)] p-6 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-6">
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
           <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] p-5 rounded-2xl">
              <p className="text-[var(--text-dim)] text-sm">معدل التحويل (Conversion Rate)</p>
              <h3 className="text-2xl font-bold mt-1">{metrics?.tripleCrown?.conversionRate}</h3>
              <p className="text-xs text-green-400 mt-2">↑ 12% عن الأسبوع الماضي</p>
           </div>
           <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] p-5 rounded-2xl">
              <p className="text-[var(--text-dim)] text-sm">
                {industryType === 'clinic' ? 'العوائد (Revenue Generated)' : 'إجمالي المبيعات (Gross Merchandise Value)'}
              </p>
              <h3 className="text-2xl font-bold mt-1 text-[var(--accent-primary)]">${metrics?.tripleCrown?.revenueGenerated}</h3>
              <p className="text-xs text-[var(--text-dim)] mt-2">
                {industryType === 'clinic' ? 'إجمالي قيمة حجوزات الـ AI' : 'إجمالي قيمة الطلبات (Orders) عبر الـ AI'}
              </p>
           </div>
           <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] p-5 rounded-2xl">
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
      <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] p-6 rounded-3xl h-80">
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
              <Tooltip contentStyle={{ background: 'rgba(10,10,10,0.9)', border: '1px solid var(--glass-border)', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="revenue" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
            </AreaChart>
          </ResponsiveContainer>
      </div>

    </div>
  );
}
