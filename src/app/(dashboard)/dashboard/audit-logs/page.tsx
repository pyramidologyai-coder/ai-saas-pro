'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldAlert, Search, Loader2, Calendar, FileText, User } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/Skeleton';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function loadLogs() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const superAdminEmails = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim());
      if (!superAdminEmails.includes(session.user.email || '')) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setIsAdmin(true);

      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (data) setLogs(data);
      setLoading(false);
    }
    loadLogs();
  }, []);

  if (!loading && !isAdmin) {
    return <div style={{ padding: '5rem', textAlign: 'center', color: '#ef4444' }}>غير مصرح لك بالدخول لهذه الصفحة.</div>;
  }

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) || 
    log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (log.actor_id && log.actor_id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ padding: '2rem', color: 'var(--text-main)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert color="#ef4444" /> سجلات المراقبة (Audit Logs)
          </h1>
          <p style={{ color: 'var(--text-dim)' }}>تتبع دقيق لكل التغييرات الحساسة التي حدثت في النظام (إنشاء وكالات، تغيير باقات، حذف بيانات).</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', background: 'var(--card-bg)', padding: '0.6rem 1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <Search size={18} color="var(--text-dim)" />
          <input 
            type="text" 
            placeholder="بحث في السجلات..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} 
          />
        </div>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: '24px', border: '1px solid var(--glass-border)', overflowX: 'auto', padding: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
          <thead>
            <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)' }}>
              <th style={{ padding: '1.2rem' }}>تاريخ العملية</th>
              <th style={{ padding: '1.2rem' }}>نوع العملية</th>
              <th style={{ padding: '1.2rem' }}>الكيان (Entity)</th>
              <th style={{ padding: '1.2rem' }}>معرف المستخدم (Actor)</th>
              <th style={{ padding: '1.2rem' }}>التفاصيل (Changes)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 0 }}><TableSkeleton columns={5} rows={8} /></td></tr>
            ) : filteredLogs.map((log, i) => (
              <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '1.2rem', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={14} color="var(--text-dim)" />
                    {new Date(log.created_at).toLocaleString('ar-EG')}
                  </div>
                </td>
                <td style={{ padding: '1.2rem' }}>
                  <span style={{ 
                    padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold',
                    background: log.action.includes('create') ? '#10b98120' : log.action.includes('delete') ? '#ef444420' : '#3b82f620',
                    color: log.action.includes('create') ? '#10b981' : log.action.includes('delete') ? '#ef4444' : '#3b82f6'
                  }}>
                    {log.action.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '1.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                    <FileText size={16} color="var(--accent-primary)" />
                    {log.entity_type} <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>({log.entity_id?.substring(0,8)}...)</span>
                  </div>
                </td>
                <td style={{ padding: '1.2rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <User size={14} /> {log.actor_id || 'System'}
                  </div>
                </td>
                <td style={{ padding: '1.2rem' }}>
                  <pre style={{ margin: 0, padding: '0.5rem', background: 'var(--bg-input)', borderRadius: '8px', fontSize: '0.8rem', color: '#10b981', maxWidth: '300px', overflowX: 'auto', direction: 'ltr' }}>
                    {JSON.stringify(log.changes, null, 2)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filteredLogs.length === 0 && (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>لا توجد سجلات مطابقة للبحث.</div>
        )}
      </div>
    </div>
  );
}
