'use client';
import React, { useState, useEffect } from 'react';
import { CreditCard, History, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function WalletPage() {
  const [loading, setLoading] = useState(true);

  // Mock data for transactions based on the screenshot
  const transactions = [
    {
      id: 1,
      subscription: 'Maha',
      subscriptionId: 'SID3508',
      trxDate: '2026-04-19 15:31:03',
      startDate: '2026-04-19 15:31:03',
      endDate: '2026-05-03 15:31:03',
      price: '0 SAR',
      totalUsers: 1
    },
    {
      id: 2,
      subscription: 'Marketing Specialist',
      subscriptionId: 'SID3509',
      trxDate: '2026-04-19 15:31:17',
      startDate: '2026-04-19 15:31:17',
      endDate: '2026-05-03 15:31:17',
      price: '0 SAR',
      totalUsers: 1
    },
    {
      id: 3,
      subscription: 'Virtual Doctor',
      subscriptionId: 'SID3513',
      trxDate: '2026-04-22 15:27:34',
      startDate: '2026-04-22 15:27:34',
      endDate: '2026-05-06 15:27:34',
      price: '0 SAR',
      totalUsers: 1
    }
  ];

  useEffect(() => {
    // Simulate loading data
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <div style={{ padding: '2rem', color: 'var(--text-dim)' }}>جاري التحميل...</div>;
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem' }}>
      
      {/* Header Tabs Simulation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', marginBottom: '3rem', justifyContent: 'center', gap: '2rem' }}>
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <div style={{ padding: '1rem', color: 'var(--text-dim)', cursor: 'pointer' }}>الرئيسية (Dashboard)</div>
        </Link>
        <Link href="/profile" style={{ textDecoration: 'none' }}>
          <div style={{ padding: '1rem', color: 'var(--text-dim)', cursor: 'pointer' }}>الملف الشخصي (Profile)</div>
        </Link>
        <div style={{ padding: '1rem', color: 'var(--accent-primary)', borderBottom: '2px solid var(--accent-primary)', fontWeight: 'bold', cursor: 'pointer' }}>المحفظة (My Wallet)</div>
      </div>

      <div style={{ 
        background: 'var(--card-bg)', 
        borderRadius: '24px', 
        padding: '2.5rem', 
        border: '1px solid var(--glass-border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.05)'
      }}>
        
        {/* Subscription Information */}
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CreditCard size={24} color="var(--accent-primary)" /> معلومات الاشتراك (Subscription)
          </h2>
          <p style={{ color: 'var(--text-dim)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>إدارة خطة الاشتراك الخاصة بك (Manage subscription)</p>

          <div style={{ 
            background: 'rgba(255,255,255,0.02)', 
            border: '1px solid var(--glass-border)', 
            borderRadius: '16px', 
            padding: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                PRO <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)', fontWeight: 400 }}>• 99 SAR / Mo</span>
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '1rem' }}>Get access to all advanced features</p>
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Next Bill: 2026-05-06</div>
            </div>
            
            <button style={{ 
              background: 'transparent',
              border: '1px solid #ef4444',
              color: '#ef4444',
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#ef444415';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            >
              <ShieldAlert size={18} /> إلغاء الاشتراك (Unsubscribe)
            </button>
          </div>
        </div>

        {/* Transactions History */}
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={24} color="var(--accent-primary)" /> سجل المعاملات (Transactions History)
          </h2>
          <p style={{ color: 'var(--text-dim)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>سجل المعاملات والمدفوعات الخاصة بحسابك (Record transaction from your account)</p>

          <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-dim)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                  <th style={thStyle}>No</th>
                  <th style={thStyle}>Subscription</th>
                  <th style={thStyle}>Subscription ID</th>
                  <th style={thStyle}>Trx Date</th>
                  <th style={thStyle}>Start Date</th>
                  <th style={thStyle}>End Date</th>
                  <th style={thStyle}>Price</th>
                  <th style={thStyle}>Total Users</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((trx) => (
                  <tr key={trx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.85rem' }}>
                    <td style={tdStyle}>{trx.id}</td>
                    <td style={{ ...tdStyle, color: 'var(--accent-primary)' }}>{trx.subscription}</td>
                    <td style={tdStyle}>{trx.subscriptionId}</td>
                    <td style={tdStyle}>{trx.trxDate}</td>
                    <td style={tdStyle}>{trx.startDate}</td>
                    <td style={tdStyle}>{trx.endDate}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{trx.price}</td>
                    <td style={tdStyle}>{trx.totalUsers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '1rem',
  fontWeight: 600,
  borderBottom: '1px solid var(--glass-border)'
};

const tdStyle: React.CSSProperties = {
  padding: '1rem',
  color: 'var(--text-main)'
};
