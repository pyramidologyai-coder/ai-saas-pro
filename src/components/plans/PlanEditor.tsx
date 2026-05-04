'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export const PlanEditor = () => {
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('plans').select('*').order('price_monthly', { ascending: true }).then(({ data }) => setPlans(data || []));
  }, []);

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow" dir="rtl">
      <h2 className="text-xl font-bold mb-4">إدارة الباقات الأساسية (Master Admin)</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700">
              <th className="border-b p-3">الباقة</th>
              <th className="border-b p-3">السعر الشهري</th>
              <th className="border-b p-3">السعر السنوي</th>
              <th className="border-b p-3">الرسائل</th>
            </tr>
          </thead>
          <tbody>
            {plans.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                <td className="p-3 border-b">{p.name}</td>
                <td className="p-3 border-b">{p.price_monthly} ر.س</td>
                <td className="p-3 border-b">{p.price_yearly} ر.س</td>
                <td className="p-3 border-b">{p.messages_limit === -1 ? 'غير محدود' : p.messages_limit}</td>
              </tr>
            ))}
            {plans.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-500">جاري تحميل الباقات...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
