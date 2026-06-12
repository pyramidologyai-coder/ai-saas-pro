import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        color: 'var(--text-dim)',
      }}
    >
      <Loader2 className="animate-spin" size={28} aria-hidden="true" />
      <span>Loading workspace / جاري تحميل مساحة العمل...</span>
    </div>
  );
}
