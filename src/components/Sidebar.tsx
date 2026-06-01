'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
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
  MessageCircle,
  ShieldAlert
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { getDictionary, BusinessType } from '@/lib/dictionary';
import { getActiveTenant, getAllTenants } from '@/lib/tenant';
import { useBusinessConfig } from '@/hooks/useBusinessConfig';
import { getUserPermissions, UserPermissions } from '@/lib/permissions';

const Sidebar = () => {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [businessName, setBusinessName] = useState('جارِ التحميل...');
  const [tenantType, setTenantType] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAgencyOwner, setIsAgencyOwner] = useState(() => pathname?.startsWith('/agency-admin') || pathname?.startsWith('/admin/agency-plans'));
  const [isMasterAdmin, setIsMasterAdmin] = useState(() => pathname?.startsWith('/master-admin'));
  const [tenants, setTenants] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadUserData() {
      const supabaseClient = createClient();
      const { data: { session } } = await supabaseClient.auth.getSession();
      
      // Fallback to localStorage if cookie session is missing
      let finalSession = session;
      if (!finalSession) {
         const localSession = await supabaseClient.auth.getSession();
         finalSession = localSession.data.session;
         
         // If localStorage has session but cookies don't, manually trigger auth change to set cookie
         if (finalSession) {
           await supabaseClient.auth.setSession({
             access_token: finalSession.access_token,
             refresh_token: finalSession.refresh_token
           });
         }
      }

      if (finalSession) {
         setUserEmail(finalSession.user.email || '');
         const isMaster = finalSession.user.app_metadata?.role === 'master_admin';
         setIsMasterAdmin(isMaster);

         if (isMaster) {
           // Fetch platform name from platform_settings
           const { data: platformSettings } = await supabaseClient
             .from('platform_settings')
             .select('platform_name')
             .limit(1)
             .maybeSingle();
           if (platformSettings?.platform_name) {
             setBusinessName(platformSettings.platform_name);
           } else {
             setBusinessName('Ash Agent');
           }
         } else {
           // 1. Fetch Active Tenant and All Tenants
           const activeTenant = await getActiveTenant(finalSession.user);
           const allTenantsList = await getAllTenants(finalSession.user);
           setTenants(allTenantsList);

           if (activeTenant) {
             setBusinessName(activeTenant.name);
             setTenantType(activeTenant.type);
           } else {
             setTenantType(localStorage.getItem('demo_tenant_type') || 'clinic');
             setBusinessName('مساحة عمل افتراضية');
           }
         }

         // 2. Fetch Real User Permissions and Role
         const perms = await getUserPermissions(supabaseClient, finalSession.user);
         if (perms) {
           setPermissions(perms);
           setUserRole(perms.role);
         }

         // 3. Check if Agency Owner
         const { data: agencyData } = await supabaseClient
           .from('agencies')
           .select('id')
           .eq('user_id', finalSession.user.id)
           .limit(1);
         if (agencyData && agencyData.length > 0) {
           setIsAgencyOwner(true);
         }
      }
    }
    loadUserData();
  }, []);

  useEffect(() => {
    const handlePlatformNameUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setBusinessName(customEvent.detail);
      }
    };
    window.addEventListener('platform-name-updated', handlePlatformNameUpdate);
    return () => {
      window.removeEventListener('platform-name-updated', handlePlatformNameUpdate);
    };
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
    const supabaseClient = createClient();
    await supabaseClient.auth.signOut();
    window.location.href = '/auth';
  };

  // Real user role fetched from DB, defaults to empty until loaded
  const [userRole, setUserRole] = useState<'admin' | 'staff' | 'doctor'>('admin');

  const { sidebarLabels } = useBusinessConfig(tenantType || undefined);
  const dict = getDictionary(tenantType);

  const adminNavItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t.dashboard, href: '/admin' },
    { id: 'financial', icon: TrendingUp, label: 'التحليل المالي', href: '/admin/financial' },
    ...(isAgencyOwner ? [
      { id: 'agency', icon: Network, label: 'لوحة الوكالة (Agency)', href: '/agency-admin' },
      { id: 'agency_plans', icon: CreditCard, label: 'إدارة الباقات والأسعار', href: '/admin/agency-plans' }
    ] : []),
    { id: 'master_plans', icon: Shield, label: 'باقات المنصة (Master)', href: '/admin/plans' },
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
    { id: 'dashboard', icon: LayoutDashboard, label: t.dashboard, href: '/admin' },
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

  // ─── Master Admin menu ────────────────────────────────────────────────────
  const masterNavItems = [
    { icon: Home,          label: 'الرئيسية',          href: '/master-admin/overview' },
    { icon: TrendingUp,    label: 'التحليل المالي',     href: '/master-admin/finance' },
    { icon: Wallet,        label: 'إدارة المحافظ',      href: '/master-admin/wallet' },
    { icon: Building2,     label: 'الوكالات',           href: '/master-admin/agencies' },
    { icon: Users,         label: 'العملاء الكلي',      href: '/master-admin/clients' },
    { icon: Package,       label: 'إدارة الباقات',      href: '/master-admin/plans' },
    { icon: ShieldAlert,   label: 'سجلات المراقبة',     href: '/master-admin/logs' },
    { icon: MessageCircle, label: 'الرسائل',            href: '/master-admin/messages' },
    { icon: Megaphone,     label: 'التسويق',            href: '/master-admin/marketing' },
    { icon: Settings,      label: 'الإعدادات',          href: '/master-admin/settings' },
  ];

  // ─── Super Admin (Agency Owner) menu ─────────────────────────────────────
  const agencyNavItems = [
    { icon: Home,          label: 'الرئيسية',           href: '/admin' },
    { icon: TrendingUp,    label: 'التحليل المالي',      href: '/admin/financial' },
    { icon: Users,         label: 'عملاءه',             href: '/customers' },
    { icon: Tag,           label: 'إدارة أسعاره',       href: '/admin/agency-plans' },
    { icon: MessageCircle, label: 'الرسائل',            href: '/messages' },
    { icon: Megaphone,     label: 'التسويق',            href: '/marketing' },
    { icon: Settings,      label: 'الإعدادات',          href: '/settings' },
  ];

  // ─── Admin menus by business type ─────────────────────────────────────────
  const adminMenuByType: Record<string, Array<{ icon: React.ElementType; label: string; href: string }>> = {
    clinic: [
      { icon: Home,          label: 'الرئيسية',               href: '/admin' },
      { icon: TrendingUp,    label: 'التحليل المالي',          href: '/admin/financial' },
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
      { icon: Home,          label: 'الرئيسية',               href: '/admin' },
      { icon: TrendingUp,    label: 'التحليل المالي',          href: '/admin/financial' },
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
      { icon: Home,          label: 'الرئيسية',               href: '/admin' },
      { icon: TrendingUp,    label: 'التحليل المالي',          href: '/admin/financial' },
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
      { icon: Home,          label: 'الرئيسية',               href: '/admin' },
      { icon: TrendingUp,    label: 'التحليل المالي',          href: '/admin/financial' },
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
      { icon: Home,          label: 'الرئيسية',               href: '/admin' },
      { icon: TrendingUp,    label: 'التحليل المالي',          href: '/admin/financial' },
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
      { icon: Home,          label: 'الرئيسية',               href: '/admin' },
      { icon: TrendingUp,    label: 'التحليل المالي',          href: '/admin/financial' },
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

  if (isMasterAdmin) {
    navItems = masterNavItems;
  } else if (isAgencyOwner) {
    navItems = agencyNavItems;
  } else {
    const type = tenantType || 'clinic';
    const baseMenu = adminMenuByType[type] || adminMenuByType['clinic'];

    if (permissions) {
      // 1. Dynamic RBAC filtration based on active user permissions
      navItems = baseMenu.filter(item => {
        if (item.href === '/users') return permissions.canManageUsers;
        if (item.href === '/settings') return permissions.canManageSettings;
        if (item.href === '/admin/financial') return permissions.canViewRevenue;
        if (item.href === '/billing') return permissions.canViewRevenue;
        if (item.href === '/automations') return permissions.canManageAI;
        return true; // Keep other standard items (bookings, services, team, customers, messages, etc.)
      });
    } else {
      // 2. Safe loading state: Hide sensitive pages until permissions are loaded
      const sensitive = ['/users', '/settings', '/admin/financial', '/billing', '/automations'];
      navItems = baseMenu.filter(item => !sensitive.includes(item.href));
    }
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
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{businessName}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{userEmail}</div>
            </div>
            <div className={styles.dropdownItem} onClick={handleLogout} style={{ color: '#ef4444', margin: '0.25rem 0' }}>
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