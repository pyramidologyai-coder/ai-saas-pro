'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Bell, Check, Info, AlertTriangle, AlertCircle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NotificationBell() {
  const supabase = createClient();
  const [userRole, setUserRole] = useState<'master_admin' | 'super_admin' | 'admin' | 'staff' | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const initRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      if (session.user.app_metadata?.role === 'master_admin') {
        setUserRole('master_admin');
        return;
      }
      
      const { data: agency } = await supabase.from('agencies').select('id').eq('user_id', session.user.id).maybeSingle();
      if (agency) {
        setUserRole('super_admin');
        setAgencyId(agency.id);
        return;
      }
      
      const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', session.user.id).maybeSingle();
      if (tenant) {
        setUserRole('admin');
        setTenantId(tenant.id);
        return;
      }
      
      setUserRole('staff');
    };
    initRole();
  }, []);

  useEffect(() => {
    if (!userRole) return;
    fetchNotifications();
  }, [userRole, tenantId, agencyId]);

  const fetchNotifications = async () => {
    // Determine the query
    let query = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(20);

    if (userRole === 'master_admin') {
      query = query.eq('target_role', 'master_admin');
    } else if (userRole === 'super_admin') {
      query = query.eq('target_role', 'super_admin').eq('agency_id', agencyId);
    } else if (userRole === 'admin') {
      query = query.eq('target_role', 'admin').eq('tenant_id', tenantId);
    } else {
      return; // Staff don't get these notifications
    }

    const { data, error } = await query;
    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  useEffect(() => {
    const channel = supabase.channel('realtime_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const newNotif = payload.new;
        // Filter locally just to be safe
        let shouldAdd = false;
        if (userRole === 'master_admin' && newNotif.target_role === 'master_admin') shouldAdd = true;
        if (userRole === 'super_admin' && newNotif.target_role === 'super_admin' && newNotif.agency_id === agencyId) shouldAdd = true;
        if (userRole === 'admin' && newNotif.target_role === 'admin' && newNotif.tenant_id === tenantId) shouldAdd = true;

        if (shouldAdd) {
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userRole, tenantId, agencyId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;

    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning_95': return <AlertTriangle size={18} color="#f59e0b" />;
      case 'limit_reached': return <AlertCircle size={18} color="#ef4444" />;
      default: return <Info size={18} color="#3b82f6" />;
    }
  };

  if (userRole === 'staff') return null;

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          background: 'transparent', 
          border: 'none', 
          position: 'relative', 
          cursor: 'pointer',
          padding: '0.5rem',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-main)',
          transition: '0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '0px',
            right: '0px',
            background: '#ef4444',
            color: 'white',
            fontSize: '0.65rem',
            fontWeight: 'bold',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--bg-color)'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 10px)',
          left: '0', // Adjust depending on layout (LTR/RTL)
          width: '350px',
          background: 'var(--card-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: '16px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column'
        }} dir="rtl">
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>الإشعارات</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
              >
                تحديد الكل كمقروء
              </button>
            )}
          </div>
          
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>لا توجد إشعارات حالياً</div>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} style={{ 
                  padding: '1rem', 
                  borderBottom: '1px solid rgba(255,255,255,0.02)',
                  background: notif.is_read ? 'transparent' : 'rgba(99, 102, 241, 0.05)',
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'flex-start',
                  transition: '0.2s'
                }}>
                  <div style={{ marginTop: '0.2rem' }}>
                    {getIcon(notif.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                      {notif.message}
                    </p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      {new Date(notif.created_at).toLocaleString('ar-EG')}
                    </span>
                  </div>
                  {!notif.is_read && (
                    <button 
                      onClick={() => markAsRead(notif.id)}
                      title="تحديد كمقروء"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0.2rem' }}
                    >
                      <Check size={16} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
