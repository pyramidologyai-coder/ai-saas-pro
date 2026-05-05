'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Phone, Calendar, MessageSquare, Loader2, Search, Download, Building2 } from 'lucide-react';
import UsageProgressBar from '@/components/financial/UsageProgressBar';

const CustomersPage = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('');

  useEffect(() => {
    const fetchCustomers = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const superAdminEmails = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim());
      const isMasterAdmin = superAdminEmails.includes(session.user.email || '') || session.user.user_metadata?.role === 'master_admin';

      if (isMasterAdmin) {
        setRole('master_admin');
        const { data } = await supabase
          .from('tenants')
          .select(`
            id, name, type, business_type,
            plan_type, status, created_at,
            messages_used, messages_limit,
            voice_minutes_used, voice_minutes_limit,
            subscription_end_date,
            agencies(name)
          `)
          .order('created_at', { ascending: false });
        setCustomers(data || []);
      } else {
        setRole('admin');
        // Group by phone to get unique customers from bookings
        const { data } = await supabase
          .from('bookings')
          .select('customer_name, customer_phone, created_at, source')
          .order('created_at', { ascending: false });
        
        // Basic unique filtering
        const unique = Array.from(new Map(data?.map(item => [item.customer_phone, item])).values());
        setCustomers(unique);
      }
      setLoading(false);
    };
    fetchCustomers();
  }, []);

  const exportToCSV = () => {
    if (role === 'master_admin') {
      const headers = ['الاسم', 'النوع', 'الباقة', 'الوكالة', 'الرسائل المستهلكة', 'تاريخ التجديد', 'الحالة'];
      const rows = customers.map(c => [
        c.name,
        c.business_type || c.type,
        c.plan_type,
        c.agencies?.name || 'مباشر',
        c.messages_used,
        c.subscription_end_date || '',
        c.status
      ]);
      let csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "tenants_list.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const headers = ['الاسم', 'رقم الهاتف', 'المصدر', 'تاريخ التسجيل'];
    const rows = customers.map(c => {
      // SECURITY: Auto-Anonymization (GDPR/HIPAA Compliance)
      // We do not export raw PII (Personally Identifiable Information) to local machines.
      const nameParts = (c.customer_name || '').split(' ');
      const anonName = nameParts.map((p: string) => p.charAt(0) + '*'.repeat(Math.max(1, p.length - 1))).join(' ');
      
      let anonPhone = 'غير مسجل';
      if (c.customer_phone) {
        const pStr = String(c.customer_phone);
        anonPhone = pStr.length > 6 ? pStr.substring(0, 4) + 'XXXXXX' + pStr.substring(pStr.length - 2) : 'XXX';
      }

      return [
        anonName,
        anonPhone,
        c.source || 'WhatsApp',
        new Date(c.created_at).toLocaleDateString('ar-EG')
      ];
    });
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "customers_list.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredCustomers = customers.filter(c => {
    const term = searchQuery.toLowerCase();
    
    if (role === 'master_admin') {
      const matchName = c.name?.toLowerCase().includes(term) || c.agencies?.name?.toLowerCase().includes(term);
      const matchPlan = planFilter === 'all' || c.plan_type === planFilter;
      const matchType = typeFilter === 'all' || c.type === typeFilter;
      return matchName && matchPlan && matchType;
    }
    
    const nameMatch = c.customer_name?.toLowerCase().includes(term);
    const phoneMatch = c.customer_phone?.toLowerCase().includes(term);
    return nameMatch || phoneMatch;
  });

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}><Loader2 className="animate-spin" /></div>;

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '800' }}>
            {role === 'master_admin' ? 'العملاء الكلي (Tenants)' : 'العملاء'}
          </h1>
          <p style={{ color: 'var(--text-dim)' }}>
            {role === 'master_admin' ? 'قائمة بجميع الأنشطة التجارية المسجلة في المنصة من كافة الوكالات.' : 'جميع الأشخاص الذين تفاعلوا مع الـ AI عبر المنصات المختلفة.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '1rem', background: 'var(--card-bg)', padding: '0.6rem 1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <Search size={18} color="var(--text-dim)" />
              <input 
                type="text" 
                placeholder={role === 'master_admin' ? "بحث بالاسم أو الوكالة..." : "بحث بالاسم أو الرقم..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} 
              />
            </div>
            
            {role === 'master_admin' && (
              <>
                <select 
                  value={planFilter} 
                  onChange={(e) => setPlanFilter(e.target.value)}
                  style={{ background: 'var(--card-bg)', padding: '0.6rem 1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', color: 'var(--text-main)', outline: 'none' }}
                >
                  <option value="all">كل الباقات</option>
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="pro">Pro</option>
                  <option value="vip">VIP</option>
                </select>
                
                <select 
                  value={typeFilter} 
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{ background: 'var(--card-bg)', padding: '0.6rem 1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', color: 'var(--text-main)', outline: 'none' }}
                >
                  <option value="all">كل الأنشطة</option>
                  <option value="clinic">عيادات ومراكز</option>
                  <option value="real_estate">شركات عقارية</option>
                  <option value="salon">مراكز تجميل</option>
                  <option value="car_rental">سيارات</option>
                  <option value="ecommerce">متاجر إلكترونية</option>
                  <option value="restaurant">مطاعم وكافيهات</option>
                </select>
              </>
            )}
          </div>
          <button 
            onClick={exportToCSV}
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 600 }}
          >
            <Download size={18} /> تصدير Excel
          </button>
        </div>
      </div>

      {role === 'master_admin' ? (
        <div style={{ background: 'var(--card-bg)', borderRadius: '24px', border: '1px solid var(--glass-border)', padding: '2rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)' }}>
                <th style={{ padding: '1rem' }}>النشاط التجاري</th>
                <th style={{ padding: '1rem' }}>النوع</th>
                <th style={{ padding: '1rem' }}>الباقة</th>
                <th style={{ padding: '1rem' }}>الوكالة</th>
                <th style={{ padding: '1rem', width: '25%' }}>الرسائل والصوت</th>
                <th style={{ padding: '1rem' }}>التجديد</th>
                <th style={{ padding: '1rem' }}>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((t, i) => {
                const isUnlimited = t.plan_type === 'vip' || t.messages_limit === -1;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1.2rem', fontWeight: 600, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <Building2 size={18} color="var(--accent-primary)" /> {t.name}
                    </td>
                    <td style={{ padding: '1.2rem' }}>{t.business_type || t.type}</td>
                    <td style={{ padding: '1.2rem' }}>
                      <span style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {t.plan_type || 'starter'}
                      </span>
                    </td>
                    <td style={{ padding: '1.2rem', color: t.agencies ? 'var(--text-main)' : 'var(--text-dim)' }}>
                      {t.agencies?.name || 'مباشر'}
                    </td>
                    <td style={{ padding: '1.2rem' }}>
                      <UsageProgressBar used={t.messages_used || 0} limit={t.messages_limit || 1000} label="الرسائل" isUnlimited={isUnlimited} />
                      <UsageProgressBar used={t.voice_minutes_used || 0} limit={t.voice_minutes_limit || 60} label="الصوت" isUnlimited={isUnlimited} />
                    </td>
                    <td style={{ padding: '1.2rem', fontSize: '0.9rem' }}>
                      {t.subscription_end_date ? new Date(t.subscription_end_date).toLocaleDateString('ar-EG') : 'غير محدد'}
                    </td>
                    <td style={{ padding: '1.2rem' }}>
                      <span style={{ 
                        fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: '8px', 
                        background: t.status === 'suspended' ? '#ef444420' : '#10b98120',
                        color: t.status === 'suspended' ? '#ef4444' : '#10b981',
                        fontWeight: '700'
                      }}>
                        {t.status === 'suspended' ? 'متوقف' : 'نشط'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredCustomers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-dim)' }}>لا يوجد أنشطة مطابقة للبحث.</div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {filteredCustomers.map((c, i) => (
            <div key={i} style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--glass-border)', display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(45deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: '800' }}>
                {(c.customer_name || '؟')[0]}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>{c.customer_name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                  <Phone size={14} /> 
                  {(() => {
                    // SECURITY: PII Masking (Zero-Trust Privacy)
                    if (!c.customer_phone) return 'غير مسجل';
                    const p = String(c.customer_phone);
                    if (p.length > 6) return p.substring(0, 4) + 'XXXXXX' + p.substring(p.length - 2);
                    return 'XXX';
                  })()}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-dim)' }}>
                    من: {c.source || 'WhatsApp'}
                  </span>
                  <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-dim)' }}>
                    آخر نشاط: {new Date(c.created_at).toLocaleDateString('ar-EG')}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                 <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <MessageSquare size={18} color="var(--accent-primary)" />
                 </div>
              </div>
            </div>
          ))}
          {filteredCustomers.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem', color: 'var(--text-dim)' }}>
               لا يوجد عملاء مطابقين للبحث.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomersPage;
