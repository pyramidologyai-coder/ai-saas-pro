'use client';

import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface AccessDeniedProps {
  message?: string;
}

export default function AccessDenied({ message }: AccessDeniedProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '70vh',
      padding: '2rem',
      direction: 'rtl'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '24px',
        padding: '3rem 2rem',
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 8px 32px 0 rgba(239, 68, 68, 0.05)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow effect */}
        <div style={{
          position: 'absolute',
          top: '-50px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 70%)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            marginBottom: '1.5rem',
            animation: 'pulse 2s infinite ease-in-out'
          }}>
            <ShieldAlert size={40} />
          </div>

          <h1 style={{
            color: '#ef4444',
            fontSize: '1.8rem',
            fontWeight: 800,
            marginBottom: '1rem',
            fontFamily: 'inherit'
          }}>
            غير مصرح لك بالدخول
          </h1>

          <p style={{
            color: 'var(--text-dim, #9ca3af)',
            fontSize: '1.05rem',
            lineHeight: '1.6',
            marginBottom: '0.5rem'
          }}>
            {message || 'عذراً، لا تمتلك الصلاحيات الكافية للوصول إلى هذه الصفحة.'}
          </p>
          
          <p style={{
            color: 'var(--text-dim, #6b7280)',
            fontSize: '0.9rem',
            marginTop: '1.5rem'
          }}>
            يرجى التواصل مع مدير النظام أو مالك العيادة لتعديل صلاحياتك.
          </p>
        </div>
      </div>
    </div>
  );
}
