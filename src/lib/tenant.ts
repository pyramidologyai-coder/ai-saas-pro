import { createClient } from '@/utils/supabase/client';
const supabase = createClient();

export async function getActiveTenant(sessionUser: any) {
    if (!sessionUser) return null;
    
    let tenants = null;
    // حاول تجيب الـ tenant، لو مش موجود استنى وحاول تاني (max 5 محاولات كل 500ms)
    // نعتمد على الـ RLS لجلب الأنشطة المسموحة للمستخدم الحالي
    for (let attempt = 0; attempt < 5; attempt++) {
        const { data } = await supabase.from('tenants').select('*');
        if (data && data.length > 0) {
            tenants = data;
            break;
        }
        if (attempt < 4) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    if (!tenants || tenants.length === 0) return null;

    // 1. Check if the user is an employee (has a row in public.profiles)
    // and prioritize their employee tenant as the default fallback workspace
    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', sessionUser.id)
        .maybeSingle();

    let defaultTenantId = tenants[0].id;
    if (profile && profile.tenant_id) {
        const employeeTenant = tenants.find((t: any) => t.id === profile.tenant_id);
        if (employeeTenant) {
            defaultTenantId = employeeTenant.id;
        }
    }
    
    let storedId = null;
    if (typeof window !== 'undefined') {
        storedId = localStorage.getItem('active_tenant_id');
    }
    
    // 2. Validate storedId against the allowed tenants list to prevent logical loops
    const isStoredAllowed = tenants.some((t: any) => t.id === storedId);
    const activeTenantId = isStoredAllowed ? storedId : defaultTenantId;
    
    const activeTenant = tenants.find((t: any) => t.id === activeTenantId) || tenants[0];
    
    if (typeof window !== 'undefined' && activeTenant.id !== storedId) {
        localStorage.setItem('active_tenant_id', activeTenant.id);
    }
    return activeTenant;
}

export async function getAllTenants(sessionUser: any) {
    if (!sessionUser) return [];
    const { data: tenants } = await supabase.from('tenants').select('id, name, type');
    return tenants || [];
}
