import { supabase } from '@/lib/supabase';

export async function getActiveTenant(sessionUser: any) {
    if (!sessionUser) return null;
    const { data: tenants } = await supabase.from('tenants').select('*').eq('user_id', sessionUser.id);
    if (!tenants || tenants.length === 0) return null;
    
    let storedId = null;
    if (typeof window !== 'undefined') {
        storedId = localStorage.getItem('active_tenant_id');
    }
    
    const activeTenant = tenants.find(t => t.id === storedId) || tenants[0];
    
    if (typeof window !== 'undefined' && activeTenant.id !== storedId) {
        localStorage.setItem('active_tenant_id', activeTenant.id);
    }
    return activeTenant;
}

export async function getAllTenants(sessionUser: any) {
    if (!sessionUser) return [];
    const { data: tenants } = await supabase.from('tenants').select('id, name, type').eq('user_id', sessionUser.id);
    return tenants || [];
}
