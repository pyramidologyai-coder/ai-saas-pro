import { createClient } from '@/utils/supabase/client';
const supabase = createClient();

const ACTIVE_TENANT_SELECT = [
    'id',
    'user_id',
    'agency_id',
    'name',
    'slug',
    'type',
    'business_type',
    'subscription_tier',
    'status',
    'trial_ends_at',
    'whatsapp_number_id',
    'zapier_webhook',
    'google_review_link',
    'custom_domain',
    'custom_logo_url',
    'custom_brand_name',
    'plan_type',
    'messages_used',
    'messages_limit',
    'voice_minutes_used',
    'voice_minutes_limit',
    'subscription_end_date',
    'enable_reminders',
    'enable_reviews',
    'reminder_enabled',
    'reminder_credits',
    'voice_reminder_enabled',
    'created_at',
].join(', ');

// Client-only cache variables (Never modified or read on the server to prevent cross-user leakage)
let clientActiveTenantPromise: Promise<any> | null = null;
let clientCachedUserId: string | null = null;

export function clearTenantCache() {
    if (typeof window !== 'undefined') {
        clientActiveTenantPromise = null;
        clientCachedUserId = null;
    }
}

export async function getActiveTenant(sessionUser: any, supabase?: any) {
    if (!sessionUser) return null;

    const isClient = typeof window !== 'undefined';
    const db = supabase || createClient();

    // 1. إذا كنا على السيرفر: تخطى الكاش بالكامل واستعلم مباشرة لضمان عزل البيانات 100%
    if (!isClient) {
        return fetchActiveTenantFromDb(sessionUser, db);
    }

    // 2. إذا كنا على المتصفح: استخدم الكاش المشترك بأمان كامل (خاص بمتصفح المستخدم الحالي فقط)
    if (clientCachedUserId !== sessionUser.id) {
        clearTenantCache();
        clientCachedUserId = sessionUser.id;
    }

    if (!clientActiveTenantPromise) {
        clientActiveTenantPromise = fetchActiveTenantFromDb(sessionUser, db);
    }

    return clientActiveTenantPromise;
}

// دالة جلب البيانات الفعلية من الداتابيز
async function fetchActiveTenantFromDb(sessionUser: any, supabase: any) {
    // 1. الاستعلام عن ملف الموظف أولاً لتحديد طبيعة حسابه فوراً وتجنب أي حلقة انتظار
    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', sessionUser.id)
        .maybeSingle();

    let activeTenant = null;

    // 2. قاعدة الموظفين: إذا كان موظفاً، يتم جلبه مباشرة بناءً على عيادة عمله المحددة
    if (profile && profile.tenant_id) {
        const { data: employerTenant } = await supabase
            .from('tenants')
            .select(ACTIVE_TENANT_SELECT)
            .eq('id', profile.tenant_id)
            .maybeSingle();
            
        if (employerTenant) {
            activeTenant = employerTenant;
        }
    }

    // 3. قاعدة الملاك: إذا لم يكن موظفاً، يتم الاستعلام عن عياداته المملوكة بحلقة انتظار سريعة جداً (بحد أقصى محاولتين كل 300ms)
    if (!activeTenant) {
        let tenants = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            const { data } = await supabase.from('tenants').select(ACTIVE_TENANT_SELECT);
            if (data && data.length > 0) {
                tenants = data;
                break;
            }
            if (attempt < 1) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        if (tenants && tenants.length > 0) {
            let storedId = null;
            if (typeof window !== 'undefined') {
                storedId = localStorage.getItem('active_tenant_id');
            }
            const isStoredAllowed = tenants.some((t: any) => t.id === storedId);
            const activeTenantId = isStoredAllowed ? storedId : tenants[0].id;
            activeTenant = tenants.find((t: any) => t.id === activeTenantId) || tenants[0];
        }
    }
    
    // 4. مزامنة الـ localStorage بالشركة الفعلية النشطة
    if (activeTenant && typeof window !== 'undefined' && activeTenant.id !== localStorage.getItem('active_tenant_id')) {
        localStorage.setItem('active_tenant_id', activeTenant.id);
    }
    return activeTenant;
}

export async function getAllTenants(sessionUser: any) {
    if (!sessionUser) return [];
    const { data: tenants } = await supabase.from('tenants').select('id, name, type, agency_id');
    return tenants || [];
}
