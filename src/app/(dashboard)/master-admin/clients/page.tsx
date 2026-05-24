import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
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
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient(
    { cookies: () => cookieStore as any },
    { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_ANON_KEY }
  );

  let redirectTarget: string | null = null;
  let clientsData: any[] = [];
  
  try {
    const [userRes, isMasterRes, clientsRes] = await Promise.allSettled([
      withTimeout(supabase.auth.getUser()),
      withTimeout(Promise.resolve(supabase.rpc('verify_master_admin_role'))),
      withTimeout(Promise.resolve(supabase.rpc('get_master_clients')))
    ]);

    const user = userRes.status === 'fulfilled' && userRes.value.data ? userRes.value.data.user : null;
    const isMaster = isMasterRes.status === 'fulfilled' ? isMasterRes.value.data : false;
    let fetchedData = clientsRes.status === 'fulfilled' ? clientsRes.value.data : null;

    if (!user) {
      redirectTarget = '/auth';
    } else if (!isMaster) {
      redirectTarget = '/admin';
    } else {
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
            agencies ( name, subscription_status )
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
                  agency_name: t.agencies ? t.agencies.name : '',
                  agency_status: t.agencies?.subscription_status || null,
                  agency_id: t.agency_id,
                  record_type: 'tenant'
              }));
          }
      }
    }
  } catch (e) {
    console.error('Error in MasterAdminClientsPage:', e);
    if (!redirectTarget) redirectTarget = '/admin';
  }

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
