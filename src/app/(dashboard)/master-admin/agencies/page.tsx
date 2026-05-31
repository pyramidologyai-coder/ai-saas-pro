import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { AgenciesUI } from '@/components/master-admin/AgenciesUI';

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
  const supabase = await createClient();

  let redirectTarget: string | null = null;
  let agenciesData: any[] = [];
  let plansData: any[] = [];
  let user: any = null;
  
  try {
    const [userRes, isMasterRes, agenciesRes, plansRes] = await Promise.allSettled([
      withTimeout(supabase.auth.getUser()),
      withTimeout(Promise.resolve(supabase.rpc('verify_master_admin_role'))),
      withTimeout(
        Promise.resolve(
          supabase
            .from('agencies')
            .select(`
              *,
              tenants (id)
            `)
            .order('created_at', { ascending: false })
        )
      ),
      withTimeout(
        Promise.resolve(
          supabase
            .from('plans')
            .select('*')
            .in('intended_for', ['agency', 'both'])
            .eq('is_active', true)
            .order('price_monthly', { ascending: true })
        )
      )
    ]);

    user = userRes.status === 'fulfilled' && (userRes.value as any).data ? (userRes.value as any).data.user : null;
    const isMaster = isMasterRes.status === 'fulfilled' ? isMasterRes.value.data : false;
    agenciesData = agenciesRes.status === 'fulfilled' && !(agenciesRes.value as any).error ? (agenciesRes.value as any).data || [] : [];
    plansData = plansRes.status === 'fulfilled' && !(plansRes.value as any).error ? (plansRes.value as any).data || [] : [];

    if (!user) {
      redirectTarget = '/auth';
    } else if (!isMaster) {
      redirectTarget = '/admin';
    }
  } catch (e) {
    console.error('Error in MasterAdminAgenciesPage:', e);
    if (!redirectTarget) redirectTarget = '/admin';
  }

  if (redirectTarget) {
    redirect(redirectTarget);
  }

  return <AgenciesUI initialAgencies={agenciesData} plans={plansData} adminId={user?.id} />;
}
