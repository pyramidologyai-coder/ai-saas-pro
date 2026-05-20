'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Plus, Search, ExternalLink, Briefcase } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TableSkeleton } from '@/components/ui/Skeleton';

export default function AgenciesPage() {
  const router = useRouter();
  const [agencies, setAgencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [newAgency, setNewAgency] = useState({
    name: '',
    email: '',
    whatsapp: '',
    commission_rate: 20,
    plan_slug: 'starter'
  });

  useEffect(() => {
    fetchAgencies();
  }, []);

  const fetchAgencies = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace('/auth');
      return;
    }
    
    let isMasterAdmin = false;
    try {
      const [verifyRes, isMasterRes] = await Promise.allSettled([
        supabase.rpc('verify_master_admin_role'),
        supabase.rpc('is_master_admin')
      ]);

      const verifyData = verifyRes.status === 'fulfilled' ? verifyRes.value.data : null;
      const fallbackData = isMasterRes.status === 'fulfilled' ? isMasterRes.value.data : null;

      isMasterAdmin = !!verifyData || !!fallbackData;

      if (!isMasterAdmin) {
        const userEmail = (session.user.email || '').toLowerCase();
        const superAdminEmails = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || '')
          .replace(/[^\x20-\x7E]/g, '')
          .split(',')
          .map(e => e.trim().toLowerCase())
          .filter(Boolean);
        isMasterAdmin = superAdminEmails.includes(userEmail) || session.user.user_metadata?.role === 'master_admin';
      }
    } catch (e) {
      console.error('RPC failed', e);
    }
    
    if (!isMasterAdmin) {
      router.replace('/admin');
      return;
    }

    // Fetch agencies and their tenants count
    const { data: agenciesData } = await supabase
      .from('agencies')
      .select(`
        *,
        tenants (id)
      `)
      .order('created_at', { ascending: false });

    setAgencies(agenciesData || []);
    setLoading(false);
  };

  const handleAddAgency = async () => {
    if (!newAgency.name || !newAgency.email) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { createAgencyAction } = await import('./actions');
      await createAgencyAction(newAgency, session.user.id);
      
      alert('تم إنشاء الوكالة بنجاح وإرسال بيانات الدخول.');
      setShowAddForm(false);
      fetchAgencies(); // Reload
    } catch (e: any) {
      console.error(e);
      alert('حدث خطأ: ' + e.message);
      setLoading(false);
    }
  };

  const filteredAgencies = agencies.filter(a => 
    a.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: '2rem', color: 'var(--text-main)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900 }}>الوكالات (Agencies)</h1>
          <p style={{ color: 'var(--text-dim)' }}>إدارة شركاء المنصة (Resellers) وعمولاتهم.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--card-bg)', padding: '0.6rem 1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
            <Search size={18} color="var(--text-dim)" />
            <input 
              type="text" 
              placeholder="بحث عن وكالة..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} 
            />
          </div>
          <button 
            onClick={() => setShowAddForm(true)}
            style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          >
            <Plus size={18} /> إضافة وكالة
          </button>
        </div>
      </div>

      {showAddForm && (
        <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--glass-border)', marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>إضافة وكالة جديدة</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <input placeholder="اسم الوكالة" value={newAgency.name} onChange={e => setNewAgency({...newAgency, name: e.target.value})} style={{ padding: '0.8rem', borderRadius: '10px', background: 'var(--bg-color)', border: '1px solid var(--glass-border)', color: 'var(--text-main)' }} />
            <input placeholder="إيميل المسؤول" type="email" value={newAgency.email} onChange={e => setNewAgency({...newAgency, email: e.target.value})} style={{ padding: '0.8rem', borderRadius: '10px', background: 'var(--bg-color)', border: '1px solid var(--glass-border)', color: 'var(--text-main)' }} />
            <input placeholder="رقم الواتساب" type="tel" value={newAgency.whatsapp} onChange={e => setNewAgency({...newAgency, whatsapp: e.target.value})} style={{ padding: '0.8rem', borderRadius: '10px', background: 'var(--bg-color)', border: '1px solid var(--glass-border)', color: 'var(--text-main)' }} />
            <input placeholder="نسبة العمولة %" type="number" min="0" max="50" value={newAgency.commission_rate} onChange={e => setNewAgency({...newAgency, commission_rate: parseInt(e.target.value)})} style={{ padding: '0.8rem', borderRadius: '10px', background: 'var(--bg-color)', border: '1px solid var(--glass-border)', color: 'var(--text-main)' }} />
            <select value={newAgency.plan_slug} onChange={e => setNewAgency({...newAgency, plan_slug: e.target.value})} style={{ padding: '0.8rem', borderRadius: '10px', background: 'var(--bg-color)', border: '1px solid var(--glass-border)', color: 'var(--text-main)' }}>
              <option value="starter">Starter</option>
              <option value="growth">Growth</option>
              <option value="pro">Pro</option>
              <option value="vip">VIP</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button onClick={handleAddAgency} style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '0.6rem 2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>حفظ</button>
            <button onClick={() => setShowAddForm(false)} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '0.6rem 2rem', borderRadius: '8px', cursor: 'pointer' }}>إلغاء</button>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--card-bg)', borderRadius: '24px', border: '1px solid var(--glass-border)', padding: '1rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
          <thead>
            <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)' }}>
              <th style={{ padding: '1rem' }}>اسم الوكالة</th>
              <th style={{ padding: '1rem' }}>العملاء</th>
              <th style={{ padding: '1rem' }}>إيرادها الشهري</th>
              <th style={{ padding: '1rem' }}>نسبة العمولة</th>
              <th style={{ padding: '1rem' }}>العمولة المستحقة</th>
              <th style={{ padding: '1rem' }}>الحالة</th>
              <th style={{ padding: '1rem' }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 0 }}><TableSkeleton columns={7} rows={5} /></td></tr>
            ) : filteredAgencies.map((a, i) => {
              const revenue = a.revenue || 0;
              const rate = a.commission_rate || 20;
              const commission = (revenue * rate) / 100;
              
              const now = new Date();
              const end = a.subscription_end_date ? new Date(a.subscription_end_date) : null;
              
              let statusColor = '#10b981';
              let statusText = 'نشطة 🟢';
              
              if (!end) {
                statusText = 'غير محدد';
                statusColor = '#9ca3af';
              } else if (end < now) {
                statusColor = '#ef4444';
                statusText = 'خطر (منتهية) 🔴';
              } else {
                const diffTime = Math.abs(end.getTime() - now.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays <= 7) {
                  statusColor = '#f59e0b';
                  statusText = 'تحذير (قريباً) 🟡';
                }
              }

              if (a.subscription_status === 'suspended') {
                 statusColor = '#ef4444';
                 statusText = 'موقوفة 🔴';
              }

              return (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1.2rem', fontWeight: 600 }}>
                    <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                      <Briefcase size={20} color="var(--accent-primary)" /> 
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontSize: '1rem', color: 'var(--text-main)' }}>{a.name}</span>
                        {a.contact_email && <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 400 }}>{a.contact_email}</span>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1.2rem', fontWeight: 700 }}>{a.tenants?.length || 0}</td>
                  <td style={{ padding: '1.2rem', fontWeight: 700 }}>${revenue.toLocaleString()}</td>
                  <td style={{ padding: '1.2rem', color: '#10b981', fontWeight: 700 }}>{rate}%</td>
                  <td style={{ padding: '1.2rem', color: 'var(--accent-primary)', fontWeight: 800 }}>${commission.toLocaleString()}</td>
                  <td style={{ padding: '1.2rem' }}>
                    <span style={{ background: `${statusColor}20`, color: statusColor, padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      {statusText}
                    </span>
                  </td>
                  <td style={{ padding: '1.2rem', textAlign: 'center' }}>
                    <Link href={`/master-admin/agencies/${a.id}`} style={{ textDecoration: 'none' }}>
                      <button style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', gap: '0.4rem', alignItems: 'center', margin: 'auto' }}>
                        <ExternalLink size={14} /> تفاصيل
                      </button>
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!loading && filteredAgencies.length === 0 && <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>لا توجد وكالات</div>}
      </div>
    </div>
  );
}
