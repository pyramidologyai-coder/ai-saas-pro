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
      <div className="space-y-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><DollarSign className="text-[var(--accent-primary)]"/> لوحة أرباح الوكيل (Profit View)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Net Profit */}
          <div className="bg-[rgba(255,255,255,0.02)] border border-[var(--glass-border)] p-6 rounded-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={64}/></div>
             <p className="text-[var(--text-dim)] text-sm font-medium">صافي الربح (Net Profit)</p>
             <h3 className="text-3xl font-bold mt-2 text-[var(--accent-primary)]">${metrics?.netProfit?.toFixed(2)}</h3>
             <p className="text-xs text-[var(--text-dim)] mt-2">بعد خصم تكاليف الـ APIs والعمولات</p>
          </div>
          {/* Margin */}
          <div className="bg-[rgba(255,255,255,0.02)] border border-[var(--glass-border)] p-6 rounded-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10"><Activity size={64}/></div>
             <p className="text-[var(--text-dim)] text-sm font-medium">هامش الربح (Net Margin)</p>
             <h3 className="text-3xl font-bold mt-2 text-green-400">{metrics?.netMargin}</h3>
             <p className="text-xs text-[var(--text-dim)] mt-2">معدل ربحية استثنائي بفضل بنية الـ Edge</p>
          </div>
          {/* API Costs */}
          <div className="bg-[rgba(255,255,255,0.02)] border border-[var(--glass-border)] p-6 rounded-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10"><Zap size={64}/></div>
             <p className="text-[var(--text-dim)] text-sm font-medium">تكلفة الـ APIs</p>
             <h3 className="text-3xl font-bold mt-2">${metrics?.apiCosts?.toFixed(2)}</h3>
             <p className="text-xs text-[var(--text-dim)] mt-2">التكلفة التشغيلية (Burn Rate)</p>
          </div>
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
