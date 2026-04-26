'use client';

import React from 'react';
import styles from './Reports.module.css';
import { TrendingUp, Users, Calendar, DollarSign, Download } from 'lucide-react';

const ReportsPage = () => {
  const chartData = [
    { label: 'السبت', value: '60%' },
    { label: 'الأحد', value: '80%' },
    { label: 'الاثنين', value: '45%' },
    { label: 'الثلاثاء', value: '90%' },
    { label: 'الأربعاء', value: '70%' },
    { label: 'الخميس', value: '100%' },
    { label: 'الجمعة', value: '30%' },
  ];

  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--text-main)' }}>التقارير والتحليلات</h1>
        <button style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', padding: '0.75rem 1.5rem', borderRadius: '12px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Download size={18} />
          تصدير PDF
        </button>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-dim)' }}>إجمالي الإيرادات</span>
            <DollarSign size={20} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-main)' }}>12,450 ج.م</div>
          <div style={{ color: '#10b981', fontSize: '0.875rem', marginTop: '0.5rem' }}>+15% عن الشهر الماضي</div>
        </div>
        <div className={styles.statCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-dim)' }}>حجوزات جديدة</span>
            <Calendar size={20} color="var(--accent-secondary)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-main)' }}>148</div>
          <div style={{ color: '#10b981', fontSize: '0.875rem', marginTop: '0.5rem' }}>+8% عن الأسبوع الماضي</div>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h3>نشاط الحجوزات الأسبوعي</h3>
          <div className={styles.chartBarContainer}>
            {chartData.map((item, idx) => (
              <div key={idx} className={styles.bar} style={{ height: item.value }}>
                <span className={styles.barLabel}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.card}>
          <h3>توزيع القنوات</h3>
          <div style={{ marginTop: '1rem' }}>
            {[
              { name: 'واتساب', value: 65, color: '#25D366' },
              { name: 'إنستجرام', value: 20, color: '#E4405F' },
              { name: 'فيسبوك', value: 15, color: '#1877F2' }
            ].map((channel, idx) => (
              <div key={idx} style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                  <span>{channel.name}</span>
                  <span>{channel.value}%</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${channel.value}%`, height: '100%', background: channel.color }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
