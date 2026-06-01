'use client';
import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  Users, 
  CalendarCheck, 
  MessageCircle 
} from 'lucide-react';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { createClient } from '@/utils/supabase/client';
import { getDictionary } from '@/lib/dictionary';
import { getActiveTenant } from '@/lib/tenant';
import CognitiveDashboard from '../../app/(dashboard)/admin/cognitive-view';

export default function ClientDashboard() {
  const supabase = createClient();
  const [dict, setDict] = useState(() => getDictionary('clinic'));
  const [aiStats, setAiStats] = useState({ ai: 0, human: 0 });
  const [stats, setStats] = useState([
    { label: 'إجمالي الحجوزات', value: '...', trend: '+12%', icon: CalendarCheck, color: '#6366f1' },
    { label: 'مرضى جدد', value: '...', trend: '+5%', icon: Users, color: '#a855f7' },
    { label: 'استقلالية الذكاء الاصطناعي', value: '...', trend: 'ممتاز', icon: MessageCircle, color: '#06b6d4' },
    { label: 'الإيرادات المتوقعة', value: '...', trend: '+20%', icon: TrendingUp, color: '#10b981' },
  ]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [currentType, setCurrentType] = useState<string>('clinic');
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMaster, setIsMaster] = useState(false);

  const handleTypeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value;
    setCurrentType(newType);
    setDict(getDictionary(newType));
    
    // Update labels instantly
    const newDict = getDictionary(newType);
    setStats(prev => [
      { ...prev[0], label: newDict.totalBookings },
      { ...prev[1], label: newDict.newCustomers },
      { ...prev[2] },
      { ...prev[3], label: newDict.revenue }
    ]);

    if (tenantId) {
      await supabase.from('tenants').update({ type: newType }).eq('id', tenantId);
    }
    localStorage.setItem('demo_tenant_type', newType);
    window.location.reload();
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const oauthCode = params.get('code');
        if (oauthCode) {
          await supabase.auth.exchangeCodeForSession(oauthCode);
          window.history.replaceState({}, '', window.location.pathname);
        }

        let session = (await supabase.auth.getSession()).data.session;

        if (!session) {
          window.location.href = '/auth';
          return;
        }
        
        const isMasterUser = session.user.app_metadata?.role === 'master_admin';
        setIsMaster(isMasterUser);

        const tenant = await getActiveTenant(session.user);
        
        if (!tenant && isMasterUser) {
           const { count: agenciesCount } = await supabase.from('agencies').select('*', { count: 'exact', head: true });
           const { count: tenantsCount } = await supabase.from('tenants').select('*', { count: 'exact', head: true });
           
           const { data: agRev } = await supabase.from('agencies').select('revenue, commission_rate');
           const { data: tnRev } = await supabase.from('tenants').select('revenue, agency_id, messages_used');
           
           let totalPlatformRevenue = 0;
           let totalMessages = 0;
           tnRev?.forEach(t => { 
             if (!t.agency_id) totalPlatformRevenue += (t.revenue || 0); 
             totalMessages += (t.messages_used || 0);
           });
           agRev?.forEach(a => { totalPlatformRevenue += ((a.revenue || 0) * (a.commission_rate || 20) / 100); });

           setStats([
             { label: 'إجمالي إيرادات المنصة', value: `$${totalPlatformRevenue.toLocaleString()}`, trend: totalPlatformRevenue > 0 ? '+15%' : '0%', icon: TrendingUp, color: '#10b981' },
             { label: 'عدد الوكالات النشطة', value: agenciesCount?.toString() || '0', trend: agenciesCount ? 'نمو مستمر' : '0%', icon: Users, color: '#6366f1' },
             { label: 'عدد العملاء الكلي', value: tenantsCount?.toString() || '0', trend: tenantsCount ? '+8%' : '0%', icon: Users, color: '#a855f7' },
             { label: 'رسائل الكلية', value: totalMessages.toLocaleString(), trend: totalMessages > 0 ? 'ممتاز' : '0%', icon: MessageCircle, color: '#06b6d4' },
           ]);
           
           setLoading(false);
           return;
        }
        
        if (!tenant) {
          window.location.href = '/onboarding';
          return;
        }

        setTenantId(tenant.id);
        setCurrentType(tenant.type || 'clinic');

        const currentDict = getDictionary(tenant.type);
        setDict(currentDict);

        const { count: bookingCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id);
        
        const { data: customers } = await supabase.from('bookings').select('customer_phone').eq('tenant_id', tenant.id);
        const uniqueCustomers = new Set(customers?.map(c => c.customer_phone)).size;

        const { data: bookings } = await supabase
          .from('bookings')
          .select('*, items (name)')
          .eq('tenant_id', tenant.id)
          .order('booking_time', { ascending: false })
          .limit(5);

        const { count: aiMsgs } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('sender', 'model');
        const { count: allMsgs } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id);
        const aiIndep = allMsgs && allMsgs > 0 ? Math.round(((aiMsgs || 0) / allMsgs) * 100) : 0;
        const aiHuman = allMsgs && allMsgs > 0 ? 100 - aiIndep : 0;
        
        setAiStats({ ai: aiIndep, human: aiHuman });

        setStats([
          { label: currentDict.totalBookings, value: bookingCount?.toString() || '0', trend: bookingCount ? '+12%' : '0%', icon: CalendarCheck, color: '#6366f1' },
          { label: currentDict.newCustomers, value: uniqueCustomers.toString(), trend: uniqueCustomers > 0 ? '+5%' : '0%', icon: Users, color: '#a855f7' },
          { label: 'استقلالية الذكاء الاصطناعي', value: `${aiIndep}%`, trend: aiIndep > 50 ? 'ممتاز' : '0%', icon: MessageCircle, color: '#06b6d4' },
          { label: currentDict.revenue, value: (bookingCount ? bookingCount * 300 : 0).toLocaleString() + ' ج.م', trend: bookingCount ? '+20%' : '0%', icon: TrendingUp, color: '#10b981' },
        ]);

        setRecentBookings(bookings || []);
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {isMaster && !tenantId && <CognitiveDashboard isAgency={true} tenantId="master" industryType="clinic" />}
      {tenantId && <CognitiveDashboard tenantId={tenantId} isAgency={isMaster} industryType={currentType as any} />}
      
      {!isMaster && (
        <div style={{ 
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 182, 212, 0.1))', 
          padding: '1rem 1.5rem', 
          borderRadius: '16px',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <div>
            <h3 style={{ color: '#10b981', margin: '0 0 0.2rem 0', fontSize: '1rem' }}>وضع تجربة المجالات (Demo Mode)</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: 0 }}>غيّر المجال من هنا وشوف إزاي لوحة التحكم والمصطلحات هتتغير أوتوماتيك!</p>
          </div>
          <select 
            value={currentType} 
            onChange={handleTypeChange}
            style={{
              background: 'var(--card-bg)',
              color: 'var(--text-main)',
              border: '1px solid var(--glass-border)',
              padding: '0.8rem 1.2rem',
              borderRadius: '12px',
              outline: 'none',
              fontSize: '0.9rem',
              cursor: 'pointer',
              minWidth: '200px'
            }}
          >
            <option value="clinic">عيادة / مركز طبي</option>
            <option value="real_estate">شركة عقارات</option>
            <option value="salon">مركز تجميل / سبا</option>
            <option value="car_rental">معرض سيارات</option>
            <option value="ecommerce">متجر إلكتروني</option>
            <option value="restaurant">مطعم / كافيه</option>
          </select>
        </div>
      )}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        {loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          stats.map((stat, i) => (
            <div key={i} style={{
              background: 'var(--card-bg)',
              padding: '1.5rem',
              borderRadius: '24px',
              border: '1px solid var(--glass-border)',
              backdropFilter: 'blur(10px)',
              transition: '0.3s'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '14px', 
                  background: `${stat.color}15`, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: stat.color
                }}>
                  <stat.icon size={24} />
                </div>
                <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>{stat.trend}</span>
              </div>
              <h3 style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{stat.label}</h3>
              <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{stat.value}</div>
            </div>
          ))
        )}
      </section>

      <section style={{ 
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05))', 
        borderRadius: '24px', 
        padding: '2rem', 
        border: '1px solid rgba(99, 102, 241, 0.2)' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ color: 'var(--text-bright)', marginBottom: '0.5rem' }}>أداء السكرتير الذكي هذا الشهر</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.95rem' }}>كم عدد {dict.bookings} التي تعامل معها الذكاء الاصطناعي بمفرده دون تدخل بشري؟</p>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#a5b4fc' }}>
            {aiStats.ai}<span style={{ fontSize: '1.5rem' }}>%</span>
          </div>
        </div>
        
        <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ 
            width: `${aiStats.ai}%`, 
            height: '100%', 
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', 
            borderRadius: '10px',
            boxShadow: '0 0 15px rgba(99, 102, 241, 0.5)'
          }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.8rem', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
          <span>تدخل بشري ({aiStats.human}%)</span>
          <span>إغلاق آلي بالكامل ({aiStats.ai}%)</span>
        </div>
      </section>

      <section style={{ 
        background: 'var(--card-bg)', 
        borderRadius: '24px', 
        padding: '2rem', 
        border: '1px solid var(--glass-border)' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2>{dict.recentActivity}</h2>
          <button style={{ 
            background: 'var(--accent-primary)', 
            color: 'var(--text-main)', 
            border: 'none', 
            padding: '0.6rem 1.2rem', 
            borderRadius: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}>تحديث البيانات</button>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)' }}>
                <th style={{ textAlign: 'right', padding: '1rem' }}>الاسم</th>
                <th style={{ textAlign: 'right', padding: '1rem' }}>{dict.item}</th>
                <th style={{ textAlign: 'right', padding: '1rem' }}>التوقيت</th>
                <th style={{ textAlign: 'right', padding: '1rem' }}>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1.2rem' }}>{row.customer_name}</td>
                  <td style={{ padding: '1.2rem' }}>{row.items?.name || 'خدمة عامة'}</td>
                  <td style={{ padding: '1.2rem' }}>{new Date(row.booking_time).toLocaleString('ar-EG', { hour: 'numeric', minute: 'numeric' })}</td>
                  <td style={{ padding: '1.2rem' }}>
                    <span style={{ 
                      padding: '0.4rem 0.8rem', 
                      borderRadius: '8px', 
                      fontSize: '0.8rem',
                      background: row.status === 'confirmed' ? '#10b98115' : '#f59e0b15',
                      color: row.status === 'confirmed' ? '#10b981' : '#f59e0b'
                    }}>{row.status === 'confirmed' ? 'مؤكد' : 'قيد الانتظار'}</span>
                  </td>
                </tr>
              ))}
              {!loading && recentBookings.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <CalendarCheck size={48} color="rgba(255,255,255,0.1)" />
                      <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>الأرقام 0</div>
                      <div style={{ fontSize: '0.9rem' }}>ابدأ بإضافة عملاء ومشاركة رابط الواتساب</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
