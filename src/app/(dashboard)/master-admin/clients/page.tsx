import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ClientsUI } from '@/components/master-admin/ClientsUI';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function withTimeout<T>(promise: Promise<T>, ms = 10000): Promise<Awaited<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('timeout')), ms);
      })
    ]);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    throw error;
  }
}

export default async function MasterAdminClientsPage() {
  const supabase = createServerComponentClient(
    { cookies },
    { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_ANON_KEY }
  );

  let redirectTarget: string | null = null;
  let isMaster = false;
  let clientsData: any[] = [];
  
  try {
    const { data: { user }, error: authError } = await withTimeout(supabase.auth.getUser());
    if (authError || !user) {
      redirectTarget = '/auth';
    } else {
      const [verifyRes, isMasterRes] = await Promise.allSettled([
        withTimeout(Promise.resolve(supabase.rpc('verify_master_admin_role'))),
        withTimeout(Promise.resolve(supabase.rpc('is_master_admin')))
      ]);

      const verifyData = verifyRes.status === 'fulfilled' ? verifyRes.value.data : null;
      const isMasterFallback = isMasterRes.status === 'fulfilled' ? isMasterRes.value.data : null;

      isMaster = !!verifyData || !!isMasterFallback;

      if (!isMaster) {
        const userEmail = (user.email || '').toLowerCase();
        const superAdminEmails = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || '')
          .replace(/[^\x20-\x7E]/g, '')
          .split(',')
          .map(e => e.trim().toLowerCase())
          .filter(Boolean);
        isMaster = superAdminEmails.includes(userEmail) || user.user_metadata?.role === 'master_admin';
      }

      if (!isMaster) {
        redirectTarget = '/admin';
      } else {
        // Fetch clients safely with Promise.allSettled
        const clientsRes = await Promise.allSettled([
          withTimeout(Promise.resolve(supabase.rpc('get_master_clients')))
        ]);
        
        let fetchedData = null;
        if (clientsRes[0].status === 'fulfilled') {
            fetchedData = clientsRes[0].value.data;
        }

        if (fetchedData && Array.isArray(fetchedData)) {
            clientsData = fetchedData;
        } else {
            // Fallback query if RPC doesn't exist or fails
            const fallback = await withTimeout(Promise.resolve(supabase.from('tenants').select(`
              id,
              name,
              type,
              plan_type,
              status,
              trial_ends_at,
              messages_used,
              messages_limit,
              agency_id,
              agencies ( name )
            `).order('created_at', { ascending: false })));
            
            if (fallback.data) {
                clientsData = fallback.data.map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    type: t.type,
                    plan_type: t.plan_type,
                    status: t.status,
                    end_date: t.trial_ends_at,
                    messages_used: t.messages_used,
                    messages_limit: t.messages_limit,
                    agency_name: t.agencies ? t.agencies.name : '' // direct if empty
                }));
            }
        }
      }
    }
  } catch (e) {
    console.error('Error in MasterAdminClientsPage:', e);
    // Use fallback to /admin instead of failing the request entirely
    if (!redirectTarget) redirectTarget = '/admin';
  }

  // Redirect MUST be outside try/catch
  if (redirectTarget) {
    redirect(redirectTarget);
  }

  // UUID Validation & Scrubbing Sensitive Data
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  const sanitizedClients = clientsData.map((client: any) => {
      // ⛔ Remove sensitive fields
      const { meta_token, api_key, gemini_api_key, commission_rate, ...safeClient } = client;
      return safeClient;
  }).filter((c: any) => c.id && UUID_REGEX.test(c.id));

  return (
    <ClientsUI initialClients={sanitizedClients} />
  );
}
