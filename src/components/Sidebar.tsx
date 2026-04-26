'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.css';
import { 
  LayoutDashboard, 
  Calendar, 
  MessageSquare, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut,
  Briefcase,
  Megaphone,
  Bot,
  Building2,
  Wallet
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const Sidebar = () => {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [businessName, setBusinessName] = useState('جارِ التحميل...');
  const [businessType, setBusinessType] = useState('Clinic');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    async function loadUserData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserEmail(session.user.email || '');
        const { data: tenant } = await supabase
          .from('tenants')
          .select('name, type')
          .eq('user_id', session.user.id)
          .single();
        if (tenant) {
          setBusinessName(tenant.name);
          setBusinessType(tenant.type === 'restaurant' ? 'Restaurant' : 'Clinic');
        }
      }
    }
    loadUserData();
  }, []);

  // Mocking user role for demonstration
  const [userRole, setUserRole] = useState<'admin' | 'staff'>('admin');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  const adminNavItems = [
    { icon: LayoutDashboard, label: t.dashboard, href: '/dashboard' },
    { icon: Briefcase, label: t.services, href: '/services' },
    { icon: Calendar, label: t.bookings, href: '/bookings' },
    { icon: MessageSquare, label: t.messages, href: '/messages' },
    { icon: Bot, label: 'الرسائل التلقائية', href: '/automations' },
    { icon: Users, label: t.customers, href: '/customers' },
    { icon: Megaphone, label: 'التسويق', href: '/marketing' },
    { icon: Users, label: 'فريق العمل', href: '/team' },
    { icon: Building2, label: 'إدارة الفروع', href: '/branches' },
    { icon: BarChart3, label: t.reports, href: '/reports' },
    { icon: Wallet, label: 'المحفظة', href: '/wallet' },
    { icon: Settings, label: t.settings, href: '/settings' },
  ];

  const staffNavItems = [
    { icon: LayoutDashboard, label: t.dashboard, href: '/dashboard' },
    { icon: Calendar, label: t.bookings, href: '/bookings' },
    { icon: MessageSquare, label: t.messages, href: '/messages' },
    { icon: Users, label: t.customers, href: '/customers' },
  ];

  const navItems = userRole === 'admin' ? adminNavItems : staffNavItems;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoContainer}>
        <div className={styles.logoGlow}></div>
        <h1 className={styles.logoText}>AI SAAS PRO</h1>
        <div className={styles.aiStatus}>
          <span className={styles.pulseDot}></span>
          AI Active
        </div>
      </div>
      
      <div className={styles.businessContext}>
        <div className={styles.businessBadge}>{businessType} Mode</div>
        <p className={styles.businessName}>{businessName}</p>
      </div>

      <nav className={styles.nav}>
        {navItems.map((item, index) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={index} 
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <item.icon className={styles.navIcon} />
              <span>{item.label}</span>
              {isActive && <div className={styles.activeIndicator}></div>}
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <div className={styles.userCard}>
          <div className={styles.avatar}>{userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}</div>
          <div className={styles.userInfo}>
            <h4 style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>{userEmail || 'User'}</h4>
            <p>Admin</p>
          </div>
        </div>
        <div className={styles.logoutBtn} onClick={handleLogout} style={{ cursor: 'pointer' }}>
          <LogOut size={18} />
          <span>{t.logout}</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
