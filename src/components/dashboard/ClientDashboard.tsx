'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, 
  Users, 
  CalendarCheck, 
  MessageCircle,
  Sparkles,
  Settings,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { createClient } from '@/utils/supabase/client';
import { getDictionary, type Locale } from '@/lib/dictionary';
import { getActiveTenant } from '@/lib/tenant';
import CognitiveDashboard from '../../app/(dashboard)/admin/cognitive-view';

const pilotGuide = {
  ar: {
    title: 'وضع التجربة المحكومة (Controlled Pilot Mode)',
    description: 'أهلاً بك في المرحلة التجريبية الأولى لمنصة Automology.ai. لقد تم إعداد حسابك وتفعيله كشريك تجريبي.',
    status: 'حساب تجريبي نشط',
    journeyLabel: 'مسار البدء السريع',
    stepLabel: 'الخطوة',
    steps: [
      '⚙️ ضبط ساعات العمل: ادخل إلى صفحة الإعدادات لتحديد تخصص النشاط التجاري ومواعيد العمل والمدة الافتراضية للجلسات.',
      '💬 اختبار السكرتير الذكي: استخدم المحادثة التفاعلية في لوحة التحكم لمشاهدة كيف يقوم الذكاء الاصطناعي بإدارة وحجز المواعيد تلقائياً.',
      '📅 أول حجز تجريبي يدوي: توجه إلى صفحة الحجوزات وأضف حجزاً يدوياً بنفسك لملاحظة كيف يظهر العميل مباشرة في قائمة العملاء.',
    ],
    actionsLabel: 'إجراءات سريعة',
    settingsAction: 'فتح الإعدادات',
    bookingsAction: 'فتح الحجوزات',
    warning: '🚨 تنبيه هام: يرجى استخدام بيانات تجريبية وافتراضية فقط وعدم إدخال أي أرقام أو بيانات عملاء حقيقية خلال هذه المرحلة.',
  },
  en: {
    title: '🚀 Controlled Pilot Mode',
    description: 'Welcome to the first pilot phase of Automology.ai. Your account has been set up and activated as a pilot partner.',
    status: 'Pilot account active',
    journeyLabel: 'Quick-start journey',
    stepLabel: 'Step',
    steps: [
      '⚙️ Set Business Hours: Go to Settings to specify your business specialty, working hours, and default session durations.',
      '💬 Test the Smart Agent: Use the interactive chat in your dashboard to see how the AI manages and books appointments automatically.',
      '📅 First Manual Booking: Head to the Bookings page and add a manual booking yourself to see how the customer appears instantly in your customers list.',
    ],
    actionsLabel: 'Quick actions',
    settingsAction: 'Open settings',
    bookingsAction: 'Open bookings',
    warning: '🚨 Important Notice: Please use dummy/mock data only. Do not enter any real customer names, phone numbers, or actual bookings during this phase.',
  },
} satisfies Record<Locale, {
  title: string;
  description: string;
  status: string;
  journeyLabel: string;
  stepLabel: string;
  steps: [string, string, string];
  actionsLabel: string;
  settingsAction: string;
  bookingsAction: string;
  warning: string;
}>;

export default function ClientDashboard() {
  const supabase = createClient();
  const [locale, setLocale] = useState<Locale>('ar');
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
    setDict(getDictionary(newType, locale));
    
    // Update labels instantly
    const newDict = getDictionary(newType, locale);
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

  const handleLocaleChange = () => {
    const newLocale: Locale = locale === 'ar' ? 'en' : 'ar';
    const newDict = getDictionary(currentType, newLocale);

    setLocale(newLocale);
    setDict(newDict);
    setStats(prev => [
      { ...prev[0], label: newDict.totalBookings },
      { ...prev[1], label: newDict.newCustomers },
      { ...prev[2] },
      { ...prev[3], label: newDict.revenue }
    ]);
    localStorage.setItem('dashboard_locale', newLocale);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const storedLocale = localStorage.getItem('dashboard_locale');
        const activeLocale: Locale = storedLocale === 'en' ? 'en' : 'ar';
        setLocale(activeLocale);

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

        const currentDict = getDictionary(tenant.type, activeLocale);
        setDict(currentDict);

        const { count: bookingCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id);
        
        const { data: uniqueCount } = await supabase.rpc('get_unique_customers_count', { p_tenant_id: tenant.id });
        const uniqueCustomers = uniqueCount || 0;

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
      
      {!loading && isMaster && !tenantId && <CognitiveDashboard isAgency={true} tenantId="master" industryType="clinic" />}
      {!loading && tenantId && <CognitiveDashboard tenantId={tenantId} isAgency={isMaster} industryType={currentType as any} />}

      {!loading && !isMaster && tenantId && (
        <section
          aria-labelledby="controlled-pilot-title"
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          style={{
            position: 'relative',
            overflow: 'hidden',
            textAlign: locale === 'ar' ? 'right' : 'left',
            background: locale === 'ar'
              ? 'linear-gradient(225deg, rgba(30, 27, 75, 0.88), rgba(17, 24, 39, 0.94) 52%, rgba(49, 46, 129, 0.72))'
              : 'linear-gradient(135deg, rgba(30, 27, 75, 0.88), rgba(17, 24, 39, 0.94) 52%, rgba(49, 46, 129, 0.72))',
            border: '1px solid rgba(196, 181, 253, 0.3)',
            borderRadius: '24px',
            padding: 'clamp(1.25rem, 3vw, 2rem)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 28px 80px rgba(15, 23, 42, 0.34), 0 0 42px rgba(124, 58, 237, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '-80px',
              left: locale === 'en' ? '-60px' : 'auto',
              right: locale === 'ar' ? '-60px' : 'auto',
              width: '260px',
              height: '260px',
              borderRadius: '50%',
              background: 'rgba(167, 139, 250, 0.22)',
              filter: 'blur(72px)',
              pointerEvents: 'none'
            }}
          />

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', maxWidth: '760px' }}>
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '52px',
                  height: '52px',
                  borderRadius: '16px',
                  color: '#ede9fe',
                  background: 'linear-gradient(145deg, rgba(167, 139, 250, 0.28), rgba(99, 102, 241, 0.14))',
                  border: '1px solid rgba(221, 214, 254, 0.3)',
                  boxShadow: '0 0 28px rgba(139, 92, 246, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.14)'
                }}
              >
                <Sparkles size={24} />
              </div>
              <div>
                <h2 id="controlled-pilot-title" style={{ color: '#fafafa', margin: '0 0 0.5rem', fontSize: 'clamp(1.2rem, 2.5vw, 1.55rem)', letterSpacing: '-0.02em' }}>
                  {pilotGuide[locale].title}
                </h2>
                <p style={{ color: '#cbd5e1', margin: 0, lineHeight: 1.8, fontSize: '0.95rem' }}>
                  {pilotGuide[locale].description}
                </p>
              </div>
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  padding: '0.55rem 0.8rem',
                  borderRadius: '999px',
                  color: '#ddd6fe',
                  background: 'rgba(124, 58, 237, 0.16)',
                  border: '1px solid rgba(196, 181, 253, 0.24)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
              >
                <span aria-hidden="true" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 12px rgba(52, 211, 153, 0.9)' }} />
                {pilotGuide[locale].status}
              </div>
            </div>

            <div style={{ color: '#c4b5fd', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              {pilotGuide[locale].journeyLabel}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              {[
                {
                  icon: Settings,
                  text: pilotGuide[locale].steps[0]
                },
                {
                  icon: MessageCircle,
                  text: pilotGuide[locale].steps[1]
                },
                {
                  icon: CalendarCheck,
                  text: pilotGuide[locale].steps[2]
                }
              ].map((step, index) => (
                <div
                  key={step.text}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.8rem',
                    padding: '1.05rem',
                    borderRadius: '18px',
                    background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.025))',
                    border: '1px solid rgba(221, 214, 254, 0.16)',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08)'
                  }}
                >
                  <div
                    style={{
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      color: '#ddd6fe',
                      background: 'rgba(139, 92, 246, 0.2)',
                      border: '1px solid rgba(196, 181, 253, 0.16)'
                    }}
                  >
                    <step.icon size={18} />
                  </div>
                  <div>
                    <div style={{ color: '#a78bfa', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                      {pilotGuide[locale].stepLabel} {index + 1}
                    </div>
                    <p style={{ color: '#e2e8f0', margin: 0, lineHeight: 1.75, fontSize: '0.88rem' }}>
                      {step.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginTop: '1.1rem' }}>
              <div style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}>
                {pilotGuide[locale].actionsLabel}
              </div>
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                {[
                  { href: '/settings', label: pilotGuide[locale].settingsAction, icon: Settings },
                  { href: '/bookings', label: pilotGuide[locale].bookingsAction, icon: CalendarCheck }
                ].map((action, index) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '12px',
                      color: index === 0 ? '#f5f3ff' : '#ddd6fe',
                      background: index === 0 ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.9), rgba(79, 70, 229, 0.88))' : 'rgba(255, 255, 255, 0.06)',
                      border: index === 0 ? '1px solid rgba(196, 181, 253, 0.38)' : '1px solid rgba(196, 181, 253, 0.2)',
                      boxShadow: index === 0 ? '0 10px 28px rgba(76, 29, 149, 0.3)' : 'none',
                      textDecoration: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 700
                    }}
                  >
                    <action.icon size={16} aria-hidden="true" />
                    {action.label}
                    <ArrowRight size={15} aria-hidden="true" style={{ transform: locale === 'ar' ? 'rotate(180deg)' : undefined }} />
                  </Link>
                ))}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                marginTop: '1.1rem',
                padding: '0.9rem 1rem',
                borderRadius: '14px',
                color: '#fde68a',
                background: 'rgba(245, 158, 11, 0.09)',
                border: '1px solid rgba(251, 191, 36, 0.24)'
              }}
            >
              <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
              <p style={{ margin: 0, lineHeight: 1.7, fontSize: '0.88rem' }}>
                {pilotGuide[locale].warning}
              </p>
            </div>
          </div>
        </section>
      )}
      
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
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={handleLocaleChange}
              aria-label={locale === 'ar' ? 'Switch dashboard to English' : 'تغيير لغة لوحة التحكم إلى العربية'}
              style={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
                color: 'var(--text-main)',
                border: '1px solid rgba(139, 92, 246, 0.35)',
                padding: '0.8rem 1.1rem',
                borderRadius: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {locale === 'ar' ? 'English' : 'العربية'}
            </button>
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
