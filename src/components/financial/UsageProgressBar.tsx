import React from 'react';

interface Props {
  used: number;
  limit: number;
  label: string;
  isUnlimited?: boolean;
}

export default function UsageProgressBar({ used, limit, label, isUnlimited }: Props) {
  const percentage = isUnlimited ? 0 : Math.min((used / (limit || 1)) * 100, 100);
  
  let color = '#10b981'; // Green
  
  if (!isUnlimited) {
    if (percentage >= 80) color = '#ef4444'; // Red
    else if (percentage >= 60) color = '#f59e0b'; // Orange
  }

  return (
    <div style={{ marginBottom: '1rem', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
        <span>{label}</span>
        <span style={{ direction: 'ltr' }}>
          {isUnlimited ? 'غير محدود' : `${used} / ${limit} (${percentage.toFixed(1)}%)`}
        </span>
      </div>
      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ 
          width: isUnlimited ? '100%' : `${percentage}%`, 
          height: '100%', 
          background: color, 
          borderRadius: '10px',
          transition: 'width 0.5s ease-in-out'
        }}></div>
      </div>
    </div>
  );
}
