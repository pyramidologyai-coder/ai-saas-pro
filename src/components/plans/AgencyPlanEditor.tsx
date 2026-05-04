'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export const AgencyPlanEditor = () => {
  const [agencyPlans, setAgencyPlans] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('agency_plans').select('*').then(({ data }) => setAgencyPlans(data || []));
  }, []);

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow" dir="rtl">
      <h2 className="text-xl font-bold mb-4">إدارة أسعار الوكالة (Super Admin)</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700">
              <th className="border-b p-3">الباقة</th>
              <th className="border-b p-3">سعر الماستر (الأساسي)</th>
              <th className="border-b p-3">سعرك للعميل</th>
              <th className="border-b p-3">هامش الربح</th>
            </tr>
          </thead>
          <tbody>
            {agencyPlans.map(ap => (
              <tr key={ap.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                <td className="p-3 border-b font-medium">{ap.plan_slug}</td>
                <td className="p-3 border-b">{ap.master_price_monthly} ر.س</td>
                <td className="p-3 border-b font-bold text-blue-600">{ap.agency_price_monthly} ر.س</td>
                <td className="p-3 border-b font-bold text-green-600">{ap.margin_monthly} ر.س</td>
              </tr>
            ))}
            {agencyPlans.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-500">لا توجد أسعار مخصصة للوكالة بعد.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
