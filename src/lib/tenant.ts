import { createClient } from '@/utils/supabase/client';
const supabase = createClient();

// Client-only cache variables (Never modified or read on the server to prevent cross-user leakage)
let clientActiveTenantPromise: Promise<any> | null = null;
let clientCachedUserId: string | null = null;

export function clearTenantCache() {
    if (typeof window !== 'undefined') {
        clientActiveTenantPromise = null;
        clientCachedUserId = null;
    }
}

export async function getActiveTenant(sessionUser: any) {
    if (!sessionUser) return null;

    const isClient = typeof window !== 'undefined';

    // 1. إذا كنا على السيرفر: تخطى الكاش بالكامل واستعلم مباشرة لضمان عزل البيانات 100%
    if (!isClient) {
        return fetchActiveTenantFromDb(sessionUser);
    }

    // 2. إذا كنا على المتصفح: استخدم الكاش المشترك بأمان كامل (خاص بمتصفح المستخدم الحالي فقط)
    if (clientCachedUserId !== sessionUser.id) {
        clearTenantCache();
        clientCachedUserId = sessionUser.id;
    }

    if (!clientActiveTenantPromise) {
        clientActiveTenantPromise = fetchActiveTenantFromDb(sessionUser);
    }

    return clientActiveTenantPromise;
}

// دالة جلب البيانات الفعلية من الداتابيز
async function fetchActiveTenantFromDb(sessionUser: any) {
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
            .select('*')
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
            const { data } = await supabase.from('tenants').select('*');
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
    const { data: tenants } = await supabase.from('tenants').select('id, name, type');
    return tenants || [];
}
