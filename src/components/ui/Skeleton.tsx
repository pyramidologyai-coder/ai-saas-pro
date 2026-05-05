import React from 'react';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
}

export function Skeleton({ className = '', style, width, height, borderRadius = '8px' }: SkeletonProps) {
  return (
    <div 
      className={`animate-pulse bg-gray-200 dark:bg-gray-800 ${className}`}
      style={{ 
        width: width || '100%', 
        height: height || '20px', 
        borderRadius,
        ...style 
      }}
    />
  );
}

export function TableSkeleton({ columns = 5, rows = 5 }: { columns?: number, rows?: number }) {
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} style={{ padding: '1rem' }}><Skeleton width="70%" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} style={{ padding: '1.2rem' }}>
                  <Skeleton height="15px" width={colIndex === 0 ? '80%' : '50%'} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <Skeleton width="40px" height="40px" borderRadius="50%" />
        <Skeleton width="60px" height="20px" borderRadius="12px" />
      </div>
      <Skeleton width="50%" height="30px" style={{ marginBottom: '0.5rem' }} />
      <Skeleton width="80%" height="15px" />
    </div>
  );
}
