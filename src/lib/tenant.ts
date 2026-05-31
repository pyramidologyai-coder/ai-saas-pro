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
    
    let storedId = null;
    if (typeof window !== 'undefined') {
        storedId = localStorage.getItem('active_tenant_id');
    }
    
    const activeTenant = tenants.find((t: any) => t.id === storedId) || tenants[0];
    
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
