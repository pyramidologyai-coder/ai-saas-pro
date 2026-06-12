'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard render error', {
      digest: error.digest,
      name: error.name,
    });
  }, [error]);

  return (
    <div
      role="alert"
      style={{
        maxWidth: '620px',
        margin: '4rem auto',
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--text-main)',
        background: 'var(--card-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: '16px',
      }}
    >
      <h2 style={{ marginBottom: '0.75rem' }}>Workspace unavailable / تعذر تحميل مساحة العمل</h2>
      <p style={{ color: 'var(--text-dim)', marginBottom: '1.5rem' }}>
        No changes were made. Please retry the request.
      </p>
      <button type="button" onClick={unstable_retry} style={{ cursor: 'pointer' }}>
        Try again / إعادة المحاولة
      </button>
    </div>
  );
}
