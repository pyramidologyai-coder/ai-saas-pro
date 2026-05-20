'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Error Caught:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ background: '#1e293b', padding: '3rem', borderRadius: '24px', border: '1px solid #334155', textAlign: 'center', maxWidth: '500px', width: '90%' }}>
            <div style={{ background: '#ef444420', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <AlertTriangle size={40} color="#ef4444" />
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem' }}>عذراً، حدث خطأ غير متوقع!</h1>
            <p style={{ color: '#94a3b8', marginBottom: '2rem', lineHeight: '1.6' }}>
              واجه النظام مشكلة أثناء معالجة طلبك. لقد تم تسجيل هذا الخطأ وسيقوم فريقنا بفحصه.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={() => reset()}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#3b82f6', color: 'white', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                <RefreshCw size={18} /> حاول مجدداً
              </button>
              <Link href="/admind style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: '1px solid #475569', color: '#f8fafc', padding: '0.8rem 1.5rem', borderRadius: '12px', fontWeight: 'bold', textDecoration: 'none' }}>
                <Home size={18} /> الرئيسية
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
