'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Bell } from 'lucide-react';
import styles from '../Header.module.css';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [badgeCount, setBadgeCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [role, setRole] = useState<string>('admin');

  useEffect(() => {
    let channel: any = null;

    const setupNotifications = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const superAdminEmails = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim());
      const isMasterAdmin = superAdminEmails.includes(session.user.email || '') || session.user.user_metadata?.role === 'master_admin';
      
      let currentRole = 'admin';
      let currentTenantId = null;
      let currentAgencyId = null;

      if (isMasterAdmin) {
        currentRole = 'master_admin';
      } else {
        const { data: agency } = await supabase.from('agencies').select('id').eq('user_id', session.user.id).maybeSingle();
        if (agency) {
          currentRole = 'super_admin';
          currentAgencyId = agency.id;
        } else {
          currentRole = 'admin';
          const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', session.user.id).maybeSingle();
          if (tenant) currentTenantId = tenant.id;
        }
      }
      
      setRole(currentRole);

      // Initial Fetch
      let query = supabase
        .from('notifications')
        .select('*, tenants(name), agencies(name)')
        .eq('target_role', currentRole)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (currentRole === 'super_admin' && currentAgencyId) {
        query = query.eq('agency_id', currentAgencyId);
      } else if (currentRole === 'admin' && currentTenantId) {
        query = query.eq('tenant_id', currentTenantId);
      }

      const { data } = await query;
      if (data) {
        setNotifications(data);
        setBadgeCount(data.length);
      }

      // Realtime Subscription
      channel = supabase
        .channel('notifications_channel')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `target_role=eq.${currentRole}`
        }, (payload: any) => {
          // Check agency/tenant manually since realtime filters by simple equality
          if (currentRole === 'super_admin' && payload.new.agency_id !== currentAgencyId) return;
          if (currentRole === 'admin' && payload.new.tenant_id !== currentTenantId) return;
          
          setNotifications(prev => [payload.new, ...prev]);
          setBadgeCount(prev => prev + 1);
        })
        .subscribe();
    };

    setupNotifications();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    setBadgeCount(prev => Math.max(0, prev - 1));
  };

  return (
    <div style={{ position: 'relative' }}>
      <button className={styles.iconBtn} onClick={() => setShowDropdown(!showDropdown)}>
        <Bell size={20} />
        {badgeCount > 0 && <span className={styles.badge}>{badgeCount}</span>}
      </button>

      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '120%',
          left: 0,
          background: 'var(--card-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: '16px',
          width: '320px',
          maxHeight: '400px',
          overflowY: 'auto',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          zIndex: 1000,
          padding: '1rem',
          color: 'var(--text-main)',
          direction: 'rtl'
        }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 800 }}>الإشعارات</h3>
          {notifications.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', textAlign: 'center', margin: '2rem 0' }}>لا توجد إشعارات جديدة</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {notifications.map(n => (
                <div key={n.id} onClick={() => markAsRead(n.id)} style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  background: n.type.includes('95') || n.type.includes('limit') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                  border: `1px solid ${n.type.includes('95') || n.type.includes('limit') ? '#ef444450' : '#f59e0b50'}`,
                  cursor: 'pointer'
                }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>
                    {n.type === 'limit_reached' ? '⛔ انتهى رصيد الرسائل' : 
                     n.type === 'warning_95' ? '🚨 تحذير: 95% من الرصيد' : 
                     n.type === 'warning_80' ? '⚠️ تحذير: 80% من الرصيد' : 'إشعار'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{n.message}</div>
                  {(role === 'master_admin' || role === 'super_admin') && n.tenants?.name && (
                    <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#a855f7', fontWeight: 'bold' }}>
                      النشاط: {n.tenants.name}
                    </div>
                  )}
                  {role === 'master_admin' && n.agencies?.name && (
                    <div style={{ fontSize: '0.75rem', marginTop: '0.2rem', color: '#10b981', fontWeight: 'bold' }}>
                      الوكالة: {n.agencies.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
