'use client';
import React, { useState } from 'react';
import { Building2, Plus, MapPin, Activity, DollarSign, Users, ChevronRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function BranchesPage() {
  const [showAddModal, setShowAddModal] = useState(false);

  // Mock data for branches
  const branches = [
    {
      id: 1,
      name: 'فرع مدينة نصر',
      location: 'شارع عباس العقاد',
      status: 'Active',
      revenue: '45,000 ج.م',
      bookings: 320,
      aiStatus: 'Online',
    },
    {
      id: 2,
      name: 'فرع المهندسين',
      location: 'شارع جامعة الدول',
      status: 'Active',
      revenue: '38,500 ج.م',
      bookings: 285,
      aiStatus: 'Online',
    },
    {
      id: 3,
      name: 'فرع التجمع الخامس',
      location: 'كايرو فيستيفال سيتي',
      status: 'Maintenance',
      revenue: '22,100 ج.م',
      bookings: 150,
      aiStatus: 'Offline',
    }
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
            <Building2 size={32} color="var(--accent-primary)" />
            إدارة الفروع والسلاسل (Enterprise)
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '1rem', maxWidth: '600px' }}>
            لوحة التحكم المركزية للسلاسل الكبيرة. راقب أداء كل فروعك، إيراداتها، وحالة الذكاء الاصطناعي في شاشة واحدة.
          </p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          style={{ 
            background: 'var(--accent-primary)', color: 'white', border: 'none', 
            padding: '0.8rem 1.5rem', borderRadius: '12px', fontWeight: 600, 
            display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
          }}
        >
          <Plus size={20} /> إضافة فرع جديد
        </button>
      </div>

      {/* Aggregate Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div style={statCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: '1rem', fontWeight: 600 }}>إجمالي إيرادات السلسلة</span>
            <DollarSign size={24} color="#10b981" />
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)' }}>105,600 <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>ج.م</span></div>
          <div style={{ color: '#10b981', fontSize: '0.85rem', marginTop: '0.5rem', fontWeight: 600 }}>+12% نمو عن الشهر الماضي</div>
        </div>

        <div style={statCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: '1rem', fontWeight: 600 }}>إجمالي الحجوزات</span>
            <Users size={24} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)' }}>755</div>
          <div style={{ color: '#10b981', fontSize: '0.85rem', marginTop: '0.5rem', fontWeight: 600 }}>نشط في 3 فروع</div>
        </div>

        <div style={statCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: '1rem', fontWeight: 600 }}>حالة الذكاء الاصطناعي</span>
            <Activity size={24} color="#a855f7" />
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)' }}>2 / 3</div>
          <div style={{ color: '#f59e0b', fontSize: '0.85rem', marginTop: '0.5rem', fontWeight: 600 }}>فرع واحد غير متصل بالـ AI</div>
        </div>
      </div>

      {/* Branches List */}
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-main)' }}>الفروع الحالية (Active Branches)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {branches.map((branch) => (
            <div key={branch.id} style={{ 
              background: 'var(--card-bg)', borderRadius: '20px', padding: '1.5rem', 
              border: '1px solid var(--glass-border)', position: 'relative',
              transition: 'transform 0.2s', cursor: 'pointer' 
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.4rem' }}>{branch.name}</h3>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <MapPin size={14} /> {branch.location}
                  </p>
                </div>
                <span style={{ 
                  background: branch.aiStatus === 'Online' ? '#10b98115' : '#ef444415', 
                  color: branch.aiStatus === 'Online' ? '#10b981' : '#ef4444', 
                  padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: branch.aiStatus === 'Online' ? '#10b981' : '#ef4444' }}></div>
                  AI {branch.aiStatus}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '0.3rem' }}>الإيرادات</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1.1rem' }}>{branch.revenue}</div>
                </div>
                <div style={{ width: '1px', background: 'var(--glass-border)' }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '0.3rem' }}>الحجوزات</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1.1rem' }}>{branch.bookings} عميل</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link href="/dashboard" style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}>
                  دخول للفرع <ExternalLink size={16} />
                </Link>
                <button style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

const statCardStyle: React.CSSProperties = {
  background: 'var(--card-bg)',
  borderRadius: '24px',
  padding: '2rem',
  border: '1px solid var(--glass-border)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.05)'
};
