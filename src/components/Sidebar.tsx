'use client';

import React, { useEffect, useState, useRef } from 'react';
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
  Wallet,
  UserCog,
  Shield,
  ChevronDown,
  CreditCard,
  Network,
  Plus,
  TrendingUp,
  Home,
  Heart,
  UserCheck,
  Zap,
  GitBranch,
  Receipt,
  BookOpen,
  ShoppingBag,
  Sparkles,
  Package,
  Tag,
  Car,
  Users2,
  MessageCircle
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { getDictionary, BusinessType } from '@/lib/dictionary';
import { getActiveTenant, getAllTenants } from '@/lib/tenant';
import { useBusinessConfig } from '@/hooks/useBusinessConfig';

const Sidebar = () => {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [businessName, setBusinessName] = useState('جارِ التحميل...');
  const [tenantType, setTenantType] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAgencyOwner, setIsAgencyOwner] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadUserData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserEmail(session.user.email || '');

        // 1. Fetch Active Tenant and All Tenants
        const activeTenant = await getActiveTenant(session.user);
        const allTenantsList = await getAllTenants(session.user);
        setTenants(allTenantsList);

        if (activeTenant) {
          setBusinessName(activeTenant.name);
          setTenantType(activeTenant.type);
        } else {
          setTenantType(localStorage.getItem('demo_tenant_type') || 'clinic');
        }

        // 2. Fetch User Role from profiles table
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .limit(1);

        if (profileData && profileData.length > 0 && profileData[0].role) {
          setUserRole(profileData[0].role as 'admin' | 'staff');
        } else {
          setUserRole('admin');
        }

        // 3. Check if Agency Owner
        const { data: agencyData } = await supabase
          .from('agencies')
          .select('id')
          .eq('user_id', session.user.id)
          .limit(1);
        if (agencyData && agencyData.length > 0) {
          setIsAgencyOwner(true);
        }
      }
    }
    loadUserData();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  // Real user role fetched from DB, defaults to empty until loaded
  const [userRole, setUserRole] = useState<'admin' | 'staff'>('admin');

  const { sidebarLabels } = useBusinessConfig(tenantType || undefined);
  const dict = getDictionary(tenantType);

  const adminNavItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t.dashboard, href: '/dashboard' },
    { id: 'financial', icon: TrendingUp, label: 'التحليل المالي', href: '/dashboard/financial' },
    ...(isAgencyOwner ? [
      { id: 'agency', icon: Network, label: 'لوحة الوكالة (Agency)', href: '/agency-admin' },
      { id: 'agency_plans', icon: CreditCard, label: 'إدارة الباقات والأسعار', href: '/dashboard/agency-plans' }
    ] : []),
    { id: 'master_plans', icon: Shield, label: 'باقات المنصة (Master)', href: '/super-admin/plans' },
    { id: 'services', icon: Briefcase, label: sidebarLabels.services, href: '/services' },
    { id: 'bookings', icon: Calendar, label: sidebarLabels.bookings, href: '/bookings' },
    { id: 'messages', icon: MessageSquare, label: t.messages, href: '/messages' },
    { id: 'automations', icon: Bot, label: 'الرسائل التلقائية', href: '/automations' },
    { id: 'customers', icon: Users, label: sidebarLabels.customers, href: '/customers' },
    { id: 'marketing', icon: Megaphone, label: 'التسويق', href: '/marketing' },
    { id: 'team', icon: UserCog, label: sidebarLabels.team, href: '/team' },
    { id: 'users', icon: Shield, label: 'صلاحيات المستخدمين', href: '/users' },
    { id: 'branches', icon: Building2, label: 'إدارة الفروع', href: '/branches' },
    { id: 'billing', icon: CreditCard, label: 'الفواتير والاشتراكات', href: '/billing' },
  ];

  const staffNavItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t.dashboard, href: '/dashboard' },
    { id: 'bookings', icon: Calendar, label: sidebarLabels.bookings, href: '/bookings' },
    { id: 'messages', icon: MessageSquare, label: t.messages, href: '/messages' },
    { id: 'customers', icon: Users, label: sidebarLabels.customers, href: '/customers' },
  ];

  // Feature Toggling Logic (Chameleon UI)
  const hiddenFeatures: Record<string, string[]> = {
    ecommerce: ['team', 'branches'],
    restaurant: ['team'],
    clinic: [],
    real_estate: [],
    salon: [],
    car_rental: ['team'],
  };

  const hiddenForCurrentType = tenantType ? (hiddenFeatures[tenantType] || []) : [];

  // ─── Master Admin detection ───────────────────────────────────────────────
  const superAdminEmails = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || '')
    .replace(/[^\x20-\x7E]/g, '').trim()
    .split(',').map(e => e.trim()).filter(Boolean);
  const isMasterAdmin = !!userEmail && superAdminEmails.includes(userEmail);

  // ─── Master Admin menu ────────────────────────────────────────────────────
  const masterNavItems = [
    { icon: Home,          label: 'الرئيسية',          href: '/dashboard' },
    { icon: TrendingUp,    label: 'التحليل المالي',     href: '/dashboard/financial' },
    { icon: Building2,     label: 'الوكالات',           href: '/super-admin' },
    { icon: Users,         label: 'العملاء الكلي',      href: '/customers' },
    { icon: Package,       label: 'إدارة الباقات',      href: '/super-admin/plans' },
    { icon: MessageCircle, label: 'الرسائل',            href: '/messages' },
    { icon: Megaphone,     label: 'التسويق',            href: '/marketing' },
    { icon: Settings,      label: 'الإعدادات',          href: '/settings' },
  ];

  // ─── Super Admin (Agency Owner) menu ─────────────────────────────────────
  const agencyNavItems = [
    { icon: Home,          label: 'الرئيسية',           href: '/dashboard' },
    { icon: TrendingUp,    label: 'التحليل المالي',      href: '/dashboard/financial' },
    { icon: Users,         label: 'عملاءه',             href: '/customers' },
    { icon: Tag,           label: 'إدارة أسعاره',       href: '/dashboard/agency-plans' },
    { icon: MessageCircle, label: 'الرسائل',            href: '/messages' },
    { icon: Megaphone,     label: 'التسويق',            href: '/marketing' },
    { icon: Settings,      label: 'الإعدادات',          href: '/settings' },
  ];

  // ─── Admin menus by business type ─────────────────────────────────────────
  const adminMenuByType: Record<string, Array<{ icon: React.ElementType; label: string; href: string }>> = {
    clinic: [
      { icon: Home,          label: 'الرئيسية',               href: '/dashboard' },
      { icon: TrendingUp,    label: 'التحليل المالي',          href: '/dashboard/financial' },
      { icon: Heart,         label: 'الخدمات الطبية',          href: '/services' },
      { icon: Calendar,      label: 'الحجوزات والكشوفات',      href: '/bookings' },
      { icon: Users,         label: 'المرضى',                  href: '/customers' },
      { icon: UserCheck,     label: 'الأطباء والتخصصات',       href: '/team' },
      { icon: MessageCircle, label: 'المحادثات',               href: '/messages' },
      { icon: Zap,           label: 'الرسائل التلقائية',       href: '/automations' },
      { icon: Megaphone,     label: 'التسويق',                 href: '/marketing' },
      { icon: Shield,        label: 'صلاحيات المستخدمين',      href: '/users' },
      { icon: GitBranch,     label: 'إدارة الفروع',            href: '/branches' },
      { icon: Receipt,       label: 'الفواتير والاشتراكات',    href: '/billing' },
      { icon: Settings,      label: 'الإعدادات',               href: '/settings' },
    ],
    restaurant: [
      { icon: Home,          label: 'الرئيسية',               href: '/dashboard' },
      { icon: TrendingUp,    label: 'التحليل المالي',          href: '/dashboard/financial' },
      { icon: BookOpen,      label: 'قائمة الطعام',           href: '/services' },
      { icon: ShoppingBag,   label: 'الطلبات',                href: '/bookings' },
      { icon: Users,         label: 'الزبائن',                href: '/customers' },
      { icon: Users2,        label: 'طاقم العمل',             href: '/team' },
      { icon: MessageCircle, label: 'المحادثات',              href: '/messages' },
      { icon: Zap,           label: 'الرسائل التلقائية',      href: '/automations' },
      { icon: Megaphone,     label: 'التسويق',                href: '/marketing' },
      { icon: Shield,        label: 'صلاحيات المستخدمين',     href: '/users' },
      { icon: GitBranch,     label: 'إدارة الفروع',           href: '/branches' },
      { icon: Receipt,       label: 'الفواتير والاشتراكات',   href: '/billing' },
      { icon: Settings,      label: 'الإعدادات',              href: '/settings' },
    ],
    salon: [
      { icon: Home,          label: 'الرئيسية',               href: '/dashboard' },
      { icon: TrendingUp,    label: 'التحليل المالي',          href: '/dashboard/financial' },
      { icon: Sparkles,      label: 'الخدمات',                href: '/services' },
      { icon: Calendar,      label: 'المواعيد',               href: '/bookings' },
      { icon: Users,         label: 'العميلات',               href: '/customers' },
      { icon: Users2,        label: 'فريق الصالون',           href: '/team' },
      { icon: MessageCircle, label: 'المحادثات',              href: '/messages' },
      { icon: Zap,           label: 'الرسائل التلقائية',      href: '/automations' },
      { icon: Megaphone,     label: 'التسويق',                href: '/marketing' },
      { icon: Shield,        label: 'صلاحيات المستخدمين',     href: '/users' },
      { icon: GitBranch,     label: 'إدارة الفروع',           href: '/branches' },
      { icon: Receipt,       label: 'الفواتير والاشتراكات',   href: '/billing' },
      { icon: Settings,      label: 'الإعدادات',              href: '/settings' },
    ],
    realestate: [
      { icon: Home,          label: 'الرئيسية',               href: '/dashboard' },
      { icon: TrendingUp,    label: 'التحليل المالي',          href: '/dashboard/financial' },
      { icon: Building2,     label: 'العقارات المتاحة',        href: '/services' },
      { icon: Calendar,      label: 'مواعيد المعاينات',       href: '/bookings' },
      { icon: Users,         label: 'العملاء المستثمرين',     href: '/customers' },
      { icon: UserCheck,     label: 'الوكلاء العقاريين',      href: '/team' },
      { icon: MessageCircle, label: 'المحادثات',              href: '/messages' },
      { icon: Zap,           label: 'الرسائل التلقائية',      href: '/automations' },
      { icon: Megaphone,     label: 'التسويق',                href: '/marketing' },
      { icon: Shield,        label: 'صلاحيات المستخدمين',     href: '/users' },
      { icon: GitBranch,     label: 'إدارة الفروع',           href: '/branches' },
      { icon: Receipt,       label: 'الفواتير والاشتراكات',   href: '/billing' },
      { icon: Settings,      label: 'الإعدادات',              href: '/settings' },
    ],
    store: [
      { icon: Home,          label: 'الرئيسية',               href: '/dashboard' },
      { icon: TrendingUp,    label: 'التحليل المالي',          href: '/dashboard/financial' },
      { icon: Tag,           label: 'المنتجات',               href: '/services' },
      { icon: Package,       label: 'الطلبات',                href: '/bookings' },
      { icon: Users,         label: 'المشترين',               href: '/customers' },
      { icon: Users2,        label: 'فريق المتجر',            href: '/team' },
      { icon: MessageCircle, label: 'المحادثات',              href: '/messages' },
      { icon: Zap,           label: 'الرسائل التلقائية',      href: '/automations' },
      { icon: Megaphone,     label: 'التسويق',                href: '/marketing' },
      { icon: Shield,        label: 'صلاحيات المستخدمين',     href: '/users' },
      { icon: GitBranch,     label: 'إدارة الفروع',           href: '/branches' },
      { icon: Receipt,       label: 'الفواتير والاشتراكات',   href: '/billing' },
      { icon: Settings,      label: 'الإعدادات',              href: '/settings' },
    ],
    cars: [
      { icon: Home,          label: 'الرئيسية',               href: '/dashboard' },
      { icon: TrendingUp,    label: 'التحليل المالي',          href: '/dashboard/financial' },
      { icon: Car,           label: 'السيارات المتاحة',        href: '/services' },
      { icon: Calendar,      label: 'مواعيد التجربة',         href: '/bookings' },
      { icon: Users,         label: 'المشترين',               href: '/customers' },
      { icon: Users2,        label: 'فريق المبيعات',          href: '/team' },
      { icon: MessageCircle, label: 'المحادثات',              href: '/messages' },
      { icon: Zap,           label: 'الرسائل التلقائية',      href: '/automations' },
      { icon: Megaphone,     label: 'التسويق',                href: '/marketing' },
      { icon: Shield,        label: 'صلاحيات المستخدمين',     href: '/users' },
      { icon: GitBranch,     label: 'إدارة الفروع',           href: '/branches' },
      { icon: Receipt,       label: 'الفواتير والاشتراكات',   href: '/billing' },
      { icon: Settings,      label: 'الإعدادات',              href: '/settings' },
    ],
  };

  // ─── Compute final navItems ───────────────────────────────────────────────
  let navItems: Array<{ icon: React.ElementType; label: string; href: string }>;

  if (userRole === 'staff') {
    navItems = staffNavItems;
  } else if (isMasterAdmin) {
    navItems = masterNavItems;
  } else if (isAgencyOwner) {
    navItems = agencyNavItems;
  } else {
    const type = tenantType || 'realestate';
    navItems = adminMenuByType[type] || adminMenuByType['realestate'];
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoContainer}>
        <div className={styles.logoGlow}></div>
        <h1 className={styles.logoText}>AI SAAS PRO</h1>
      </div>

      <div className={styles.workspaceSelector} ref={dropdownRef}>
        <div className={styles.workspaceHeader} onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
          <div className={styles.workspaceAvatar}>
            {businessName ? businessName.charAt(0).toUpperCase() : 'C'}
          </div>
          <div className={styles.workspaceInfo}>
            <span className={styles.workspaceName}>{businessName}</span>
            <span className={styles.workspaceEmail}>{userEmail}</span>
          </div>
          <ChevronDown size={16} className={styles.workspaceChevron} style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0)' }} />
        </div>

        {isDropdownOpen && (
          <div className={styles.workspaceDropdown}>
            {/* WORKSPACE SWITCHER */}
            <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>مساحات العمل الخاصة بك</div>
              {tenants.map((t) => (
                <div
                  key={t.id}
                  className={styles.dropdownItem}
                  onClick={() => {
                    localStorage.setItem('active_tenant_id', t.id);
                    window.location.reload();
                  }}
                  style={{ background: t.name === businessName ? 'var(--accent-primary-transparent)' : 'transparent', fontWeight: t.name === businessName ? 600 : 400 }}
                >
                  <Building2 size={16} /> {t.name}
                </div>
              ))}
              <Link href="/onboarding" className={styles.dropdownItem} onClick={() => setIsDropdownOpen(false)} style={{ color: 'var(--accent-primary)', marginTop: '0.25rem' }}>
                <Plus size={16} /> إضافة نشاط جديد
              </Link>
            </div>

            {userRole === 'admin' && (
              <>
                <Link href="/reports" className={styles.dropdownItem} onClick={() => setIsDropdownOpen(false)}>
                  <BarChart3 size={16} /> التقارير
                </Link>
                <Link href="/settings" className={styles.dropdownItem} onClick={() => setIsDropdownOpen(false)}>
                  <Settings size={16} /> الإعدادات
                </Link>
                <Link href="/wallet" className={styles.dropdownItem} onClick={() => setIsDropdownOpen(false)}>
                  <Wallet size={16} /> المحفظة
                </Link>
                <div className={styles.dropdownDivider}></div>
              </>
            )}
            <div className={styles.dropdownItem} onClick={handleLogout} style={{ color: '#ef4444' }}>
              <LogOut size={16} /> تسجيل الخروج
            </div>
          </div>
        )}
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

    </aside>
  );
};

export default Sidebar;