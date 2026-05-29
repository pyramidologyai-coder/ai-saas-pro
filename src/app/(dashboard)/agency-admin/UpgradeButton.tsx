'use client';

import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import { requestAgencyUpgradeAction } from './actions';

export default function UpgradeButton() {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await requestAgencyUpgradeAction();
      if (res.success) {
        alert('تم تسجيل طلبك! في بيئة الإنتاج الفعلية سيتم تحويلك لصفحة الدفع.');
        window.location.reload();
      }
    } catch (err: any) {
      alert(err.message || 'حدث خطأ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleUpgrade}
      disabled={loading}
      style={{ 
        background: 'linear-gradient(135deg, #f59e0b, #d97706)', 
        color: 'white', 
        border: 'none', 
        padding: '0.8rem 2rem', 
        borderRadius: '12px', 
        fontWeight: 'bold', 
        fontSize: '1.1rem', 
        cursor: 'pointer', 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '0.5rem',
        opacity: loading ? 0.7 : 1
      }}
    >
      <Building2 size={20} /> {loading ? 'جاري تسجيل الطلب...' : 'ترقية حسابي إلى وكالة الآن (499$/شهرياً)'}
    </button>
  );
}
