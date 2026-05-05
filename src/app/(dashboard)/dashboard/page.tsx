'use client';
import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  Users, 
  CalendarCheck, 
  MessageCircle 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getDictionary } from '@/lib/dictionary';
import { getActiveTenant } from '@/lib/tenant';
import CognitiveDashboard from './cognitive-view';

export default function Home() {
  const [dict, setDict] = useState(() => getDictionary('clinic'));
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
        // Supabase v2 PKCE flow: after Google OAuth, tokens arrive as ?code= query param.
        // getSession() processes the code automatically, but needs a moment.
        // Also handle legacy hash-based flow.
        const hasOAuthCallback =
          window.location.search.includes('code=') ||
          window.location.hash.includes('access_token');

        let session = (await supabase.auth.getSession()).data.session;

        if (!session && hasOAuthCallback) {
          // Wait for Supabase to exchange the PKCE code for a session (up to 4s)
          session = await new Promise(resolve => {
            const { data } = supabase.auth.onAuthStateChange((event, s) => {
              if (event === 'SIGNED_IN' && s) {
                clearTimeout(timeout);
                data.subscription.unsubscribe();
                resolve(s);
              }
            });
            const timeout = setTimeout(() => {
              data.subscription.unsubscribe();
              resolve(null);
            }, 4000);
          });
        }

        if (!session) {
          window.location.href = '/auth';
          return;
        }
        
        const userEmail = session.user.email;
        const superAdminEmails = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
        const isMasterUser = !!userEmail && superAdminEmails.includes(userEmail);
        setIsMaster(isMasterUser);

        const tenant = await getActiveTenant(session.user);
        
        // If master admin and has no tenant, just stop here but keep isMaster=true
        if (!tenant && isMasterUser) {
           const demoType = localStorage.getItem('demo_tenant_type') || 'clinic';
           setCurrentType(demoType);
           
           const demoDict = getDictionary(demoType);
           setDict(demoDict);
           
           setStats([
             { label: demoDict.totalBookings, value: '0', trend: '+12%', icon: CalendarCheck, color: '#6366f1' },
             { label: demoDict.newCustomers, value: '0', trend: '+5%', icon: Users, color: '#a855f7' },
             { label: 'استقلالية الذكاء الاصطناعي', value: '0%', trend: 'ممتاز', icon: MessageCircle, color: '#06b6d4' },
             { label: demoDict.revenue, value: '0 ج.م', trend: '+20%', icon: TrendingUp, color: '#10b981' },
           ]);
           
           setLoading(false);
           return;
        }
        
        if (!tenant) return;

        // Store tenant info for later update
        setTenantId(tenant.id);
        setCurrentType(tenant.type || 'clinic');

        const currentDict = getDictionary(tenant.type);
        setDict(currentDict);

        // 1. Fetch total bookings
        const { count: bookingCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id);
        
        // 2. Fetch unique customers (new patients)
        const { data: customers } = await supabase.from('bookings').select('customer_phone').eq('tenant_id', tenant.id);
        const uniqueCustomers = new Set(customers?.map(c => c.customer_phone)).size;

        // 3. Fetch recent bookings
        const { data: bookings } = await supabase
          .from('bookings')
          .select(`
            *,
            items (name)
          `)
          .eq('tenant_id', tenant.id)
          .order('booking_time', { ascending: false })
          .limit(5);

        setStats([
          { label: currentDict.totalBookings, value: bookingCount?.toString() || '0', trend: '+12%', icon: CalendarCheck, color: '#6366f1' },
          { label: currentDict.newCustomers, value: uniqueCustomers.toString(), trend: '+5%', icon: Users, color: '#a855f7' },
          { label: 'استقلالية الذكاء الاصطناعي', value: bookingCount ? '85%' : '0%', trend: 'ممتاز', icon: MessageCircle, color: '#06b6d4' },
          { label: currentDict.revenue, value: (bookingCount ? bookingCount * 300 : 0).toLocaleString() + ' ج.م', trend: '+20%', icon: TrendingUp, color: '#10b981' },
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
      
      {/* Demo Switcher (Can be removed in production) */}
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

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        {stats.map((stat, i) => (
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
        ))}
      </section>

      {/* AI Performance Visual Section */}
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
            85<span style={{ fontSize: '1.5rem' }}>%</span>
          </div>
        </div>
        
        {/* CSS Progress Bar */}
        <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ 
            width: '85%', 
            height: '100%', 
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', 
            borderRadius: '10px',
            boxShadow: '0 0 15px rgba(99, 102, 241, 0.5)'
          }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.8rem', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
          <span>تدخل بشري (15%)</span>
          <span>إغلاق آلي بالكامل (85%)</span>
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
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
                    لا يوجد {dict.bookings} حالية.. ابدأ بمشاركة رابط الواتساب!
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
