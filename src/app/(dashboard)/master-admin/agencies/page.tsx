import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AgenciesUI } from '@/components/master-admin/AgenciesUI';
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

export default async function MasterAdminAgenciesPage() {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient(
    { cookies: () => cookieStore as any },
    { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_ANON_KEY }
  );

  let redirectTarget: string | null = null;
  let isMaster = false;
  let agenciesData: any[] = [];
  
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

      isMaster = !!verifyData || !!isMasterFallback || user.user_metadata?.role === 'master_admin';

      if (!isMaster) {
        redirectTarget = '/admin';
      } else {
        const agenciesRes = await withTimeout(
          Promise.resolve(
            supabase
              .from('agencies')
              .select(`
                *,
                tenants (id)
              `)
              .order('created_at', { ascending: false })
          )
        );
        agenciesData = agenciesRes.data || [];
      }
    }
  } catch (e) {
    console.error('Error in MasterAdminAgenciesPage:', e);
    if (!redirectTarget) redirectTarget = '/admin';
  }

  // Redirect outside try/catch
  if (redirectTarget) {
    redirect(redirectTarget);
  }

  return <AgenciesUI initialAgencies={agenciesData} />;
}
