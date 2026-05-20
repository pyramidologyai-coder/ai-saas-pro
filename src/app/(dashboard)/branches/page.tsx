'use client';
import React, { useState, useEffect } from 'react';
import { Building2, Plus, MapPin, Activity, DollarSign, Users, ChevronRight, ExternalLink, X, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getActiveTenant } from '@/lib/tenant';

export default function BranchesPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchLocation, setNewBranchLocation] = useState('');
  const [newBranchMapUrl, setNewBranchMapUrl] = useState('');
  const [newBranchReviewUrl, setNewBranchReviewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalRevenue: 0, totalBookings: 0, onlineBranches: 0 });

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      // 1. Get current tenant (respects active workspace selection)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/auth'; return; }
      const tenantData = await getActiveTenant(session.user);
      if (!tenantData) return;
      setTenantId(tenantData.id);

      // 2. Fetch branches
      const { data: branchesData, error } = await supabase
        .from('branches')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // 3. For now, we simulate revenue/bookings per branch since we don't have real branch aggregations yet
      // Later this will be a real SQL aggregation joining the bookings table
      const formattedBranches = (branchesData || []).map(b => ({
        ...b,
        revenue: '0 ج.م',
        bookings: 0
      }));

      setBranches(formattedBranches);
      setStats({
        totalRevenue: 0,
        totalBookings: 0,
        onlineBranches: formattedBranches.filter(b => b.ai_status === 'Online').length
      });
    } catch (err) {
      console.error('Error fetching branches:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOrEditBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName) return;
    
    setIsSubmitting(true);
    try {
      if (!tenantId) throw new Error('لم يتم تحميل بيانات النشاط — يرجى تحديث الصفحة');

      if (editingBranch) {
        const { error } = await supabase.from('branches').update({
          name: newBranchName,
          location: newBranchLocation,
          google_maps_url: newBranchMapUrl,
          google_review_url: newBranchReviewUrl,
        }).eq('id', editingBranch.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('branches').insert([
          {
            tenant_id: tenantId,
            name: newBranchName,
            location: newBranchLocation,
            google_maps_url: newBranchMapUrl,
            google_review_url: newBranchReviewUrl,
            ai_status: 'Online'
          }
        ]);
        if (error) throw error;
      }

      setNewBranchName('');
      setNewBranchLocation('');
      setNewBranchMapUrl('');
      setNewBranchReviewUrl('');
      setShowAddModal(false);
      setEditingBranch(null);
      fetchBranches();
    } catch (err) {
      console.error('Error saving branch:', err);
      alert('حدث خطأ أثناء حفظ الفرع');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddModal = () => {
    setEditingBranch(null);
    setNewBranchName('');
    setNewBranchLocation('');
    setNewBranchMapUrl('');
    setNewBranchReviewUrl('');
    setShowAddModal(true);
  };

  const openEditModal = (branch: any) => {
    setEditingBranch(branch);
    setNewBranchName(branch.name || '');
    setNewBranchLocation(branch.location || '');
    setNewBranchMapUrl(branch.google_maps_url || '');
    setNewBranchReviewUrl(branch.google_review_url || '');
    setShowAddModal(true);
  };

  const handleDeleteBranch = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('هل أنت متأكد من حذف هذا الفرع؟ سيتم حذف جميع المواعيد المرتبطة به.')) return;
    
    try {
      const { error } = await supabase.from('branches').delete().eq('id', id);
      if (error) throw error;
      fetchBranches();
    } catch (err) {
      console.error('Error deleting branch:', err);
      alert('حدث خطأ أثناء الحذف');
    }
  };

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
          onClick={openAddModal}
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
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{stats.totalRevenue} <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>ج.م</span></div>
        </div>

        <div style={statCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: '1rem', fontWeight: 600 }}>إجمالي الحجوزات</span>
            <Users size={24} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{stats.totalBookings}</div>
        </div>

        <div style={statCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: '1rem', fontWeight: 600 }}>حالة الذكاء الاصطناعي</span>
            <Activity size={24} color="#a855f7" />
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{stats.onlineBranches} / {branches.length}</div>
          <div style={{ color: '#10b981', fontSize: '0.85rem', marginTop: '0.5rem', fontWeight: 600 }}>فروع متصلة بالـ AI</div>
        </div>
      </div>

      {/* Branches List */}
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-main)' }}>الفروع الحالية (Active Branches)</h2>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>جاري تحميل الفروع...</div>
        ) : branches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card-bg)', borderRadius: '20px', border: '1px dashed var(--glass-border)', color: 'var(--text-dim)' }}>
            لا يوجد فروع مسجلة حتى الآن. ابدأ بإضافة فرعك الأول!
          </div>
        ) : (
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
                      <MapPin size={14} /> {branch.location || 'بدون عنوان'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ 
                      background: branch.ai_status === 'Online' ? '#10b98115' : '#ef444415', 
                      color: branch.ai_status === 'Online' ? '#10b981' : '#ef4444', 
                      padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: branch.ai_status === 'Online' ? '#10b981' : '#ef4444' }}></div>
                      AI {branch.ai_status}
                    </span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); openEditModal(branch); }}
                      style={{ background: '#3b82f615', border: 'none', color: '#3b82f6', padding: '0.4rem', borderRadius: '8px', cursor: 'pointer', marginLeft: '0.5rem' }}
                    >
                      تعديل
                    </button>
                    <button 
                      onClick={(e) => handleDeleteBranch(branch.id, e)}
                      style={{ background: '#ef444415', border: 'none', color: '#ef4444', padding: '0.4rem', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
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
                  <Link href="/admind style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}>
                    إدارة الفرع <ExternalLink size={16} />
                  </Link>
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Branch Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--glass-border)',
            borderRadius: '24px', padding: '2rem', width: '90%', maxWidth: '500px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{editingBranch ? 'تعديل فرع' : 'إضافة فرع جديد'}</h3>
              <button onClick={() => { setShowAddModal(false); setEditingBranch(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddOrEditBranch}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)', fontWeight: 600 }}>اسم الفرع <span style={{color:'red'}}>*</span></label>
                <input 
                  type="text" 
                  required
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="مثال: فرع مدينة نصر"
                  style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '1rem' }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)', fontWeight: 600 }}>عنوان الفرع</label>
                <input 
                  type="text" 
                  value={newBranchLocation}
                  onChange={(e) => setNewBranchLocation(e.target.value)}
                  placeholder="مثال: شارع عباس العقاد"
                  style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '1rem' }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)', fontWeight: 600 }}>رابط خريطة الفرع (Google Maps)</label>
                <input 
                  type="url" 
                  value={newBranchMapUrl}
                  onChange={(e) => setNewBranchMapUrl(e.target.value)}
                  placeholder="https://maps.app.goo.gl/..."
                  style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '1rem' }}
                />
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)', fontWeight: 600 }}>رابط تقييم جوجل للفرع (Google Review)</label>
                <input 
                  type="url" 
                  value={newBranchReviewUrl}
                  onChange={(e) => setNewBranchReviewUrl(e.target.value)}
                  placeholder="https://g.page/review/..."
                  style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '1rem' }}
                />
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                style={{ 
                  width: '100%', background: 'var(--accent-primary)', color: 'white', border: 'none', 
                  padding: '1rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1
                }}
              >
                {isSubmitting ? 'جاري الإضافة...' : 'حفظ الفرع'}
              </button>
            </form>
          </div>
        </div>
      )}

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
