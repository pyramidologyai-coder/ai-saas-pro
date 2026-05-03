'use client';
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Activity, Building2 } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface Agency {
  id: string;
  name: string;
  clientCount: number;
  revenue: number;
  commission: number;
  growth: number;
  healthStatus: string;
  clients: Client[];
}

interface AgencyTableProps {
  agencies: Agency[];
}

export default function AgencyTable({ agencies }: AgencyTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    if (expandedRow === id) {
      setExpandedRow(null);
    } else {
      setExpandedRow(id);
    }
  };

  const getHealthColor = (status: string) => {
    if (status === 'ممتازة') return '#10b981';
    if (status === 'تحتاج دعم') return '#f59e0b';
    return '#ef4444';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'USD' }).format(value);
  };

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '24px', border: '1px solid var(--glass-border)', padding: '2rem', marginTop: '2rem', overflowX: 'auto' }}>
      <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
        <Activity size={24} color="var(--accent-primary)" />
        أداء الوكالات (Agency Performance)
      </h2>

      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
        <thead>
          <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)', fontSize: '0.9rem' }}>
            <th style={{ padding: '1rem' }}>اسم الوكالة</th>
            <th style={{ padding: '1rem', textAlign: 'center' }}>العملاء</th>
            <th style={{ padding: '1rem', textAlign: 'left' }}>الإيراد الكلي</th>
            <th style={{ padding: '1rem', textAlign: 'left' }}>العمولة (30%)</th>
            <th style={{ padding: '1rem', textAlign: 'center' }}>نسبة النمو</th>
            <th style={{ padding: '1rem', textAlign: 'center' }}>الحالة</th>
            <th style={{ padding: '1rem', textAlign: 'center' }}>التفاصيل</th>
          </tr>
        </thead>
        <tbody>
          {agencies.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>لا توجد وكالات حالياً</td>
            </tr>
          ) : (
            agencies.map((agency) => (
              <React.Fragment key={agency.id}>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s', background: expandedRow === agency.id ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                  <td style={{ padding: '1.2rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Building2 size={16} color="var(--text-dim)" />
                      {agency.name}
                    </div>
                  </td>
                  <td style={{ padding: '1.2rem', textAlign: 'center', color: 'var(--text-main)' }}>{agency.clientCount}</td>
                  <td style={{ padding: '1.2rem', textAlign: 'left', fontWeight: 'bold', color: 'var(--text-main)' }} dir="ltr">{formatCurrency(agency.revenue)}</td>
                  <td style={{ padding: '1.2rem', textAlign: 'left', color: '#10b981', fontWeight: 'bold' }} dir="ltr">{formatCurrency(agency.commission)}</td>
                  <td style={{ padding: '1.2rem', textAlign: 'center' }}>
                    <span style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                      +{agency.growth}%
                    </span>
                  </td>
                  <td style={{ padding: '1.2rem', textAlign: 'center' }}>
                    <span style={{ 
                      color: getHealthColor(agency.healthStatus), 
                      background: `${getHealthColor(agency.healthStatus)}15`, 
                      padding: '0.3rem 0.8rem', 
                      borderRadius: '12px', 
                      fontSize: '0.85rem',
                      fontWeight: 'bold'
                    }}>
                      {agency.healthStatus}
                    </span>
                  </td>
                  <td style={{ padding: '1.2rem', textAlign: 'center' }}>
                    <button 
                      onClick={() => toggleRow(agency.id)}
                      style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {expandedRow === agency.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </td>
                </tr>
                {expandedRow === agency.id && (
                  <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <td colSpan={7} style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <h4 style={{ marginBottom: '1rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>تفاصيل عملاء الوكالة:</h4>
                      {agency.clients.length === 0 ? (
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>لا يوجد عملاء حالياً لهذه الوكالة.</div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                          {agency.clients.map(client => (
                            <div key={client.id} style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.3rem', color: 'var(--text-main)' }}>{client.name}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                                <span style={{ color: 'var(--text-dim)' }}>{client.type === 'clinic' ? 'عيادة' : client.type === 'restaurant' ? 'مطعم' : 'أخرى'}</span>
                                <span style={{ color: client.status === 'suspended' ? '#ef4444' : '#10b981' }}>
                                  {client.status === 'suspended' ? 'متوقف' : 'نشط'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
