'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Phone, Calendar, MessageSquare, Loader2, Search, Download } from 'lucide-react';

const CustomersPage = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCustomers = async () => {
      // Group by phone to get unique customers from bookings
      const { data } = await supabase
        .from('bookings')
        .select('customer_name, customer_phone, created_at, source')
        .order('created_at', { ascending: false });
      
      // Basic unique filtering
      const unique = Array.from(new Map(data?.map(item => [item.customer_phone, item])).values());
      setCustomers(unique);
      setLoading(false);
    };
    fetchCustomers();
  }, []);

  const exportToCSV = () => {
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
    document.body.removeChild(link);
  };

  const filteredCustomers = customers.filter(c => {
    const term = searchQuery.toLowerCase();
    const nameMatch = c.customer_name?.toLowerCase().includes(term);
    const phoneMatch = c.customer_phone?.toLowerCase().includes(term);
    return nameMatch || phoneMatch;
  });

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}><Loader2 className="animate-spin" /></div>;

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '800' }}>العملاء والمرضى</h1>
          <p style={{ color: 'var(--text-dim)' }}>جميع الأشخاص الذين تفاعلوا مع الـ AI عبر المنصات المختلفة.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem', background: 'var(--card-bg)', padding: '0.6rem 1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
            <Search size={18} color="var(--text-dim)" />
            <input 
              type="text" 
              placeholder="بحث بالاسم أو الرقم..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} 
            />
          </div>
          <button 
            onClick={exportToCSV}
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 600 }}
          >
            <Download size={18} /> تصدير Excel
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {filteredCustomers.map((c, i) => (
          <div key={i} style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--glass-border)', display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(45deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: '800' }}>
              {c.customer_name[0]}
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
    </div>
  );
};

export default CustomersPage;
