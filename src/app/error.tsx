'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Error Caught:', error);
  }, [error]);

  return (
    <div style={{ height: 'calc(100vh - 80px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)', padding: '2rem' }}>
      <div style={{ background: 'var(--card-bg)', padding: '3rem', borderRadius: '24px', border: '1px solid var(--border-color)', textAlign: 'center', maxWidth: '500px', width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ background: '#ef444420', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
          <AlertTriangle size={40} color="#ef4444" />
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem' }}>حدث خطأ!</h1>
        <p style={{ color: 'var(--text-dim)', marginBottom: '2rem', lineHeight: '1.6' }}>
          يبدو أن هناك مشكلة أثناء عرض هذه الصفحة. يمكنك محاولة إعادة التحميل أو العودة للرئيسية.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button 
            onClick={() => reset()}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            <RefreshCw size={18} /> حاول مجدداً
          </button>
          <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.8rem 1.5rem', borderRadius: '12px', fontWeight: 'bold', textDecoration: 'none' }}>
            <Home size={18} /> العودة للوحة التحكم
          </Link>
        </div>
      </div>
    </div>
  );
}
