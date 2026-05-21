import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { FinanceUI } from '@/components/master-admin/FinanceUI';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function withTimeout<T>(
  promise: Promise<T> | PromiseLike<T>,
  ms = 10000
): Promise<Awaited<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
  try {
    const result = await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('timeout')), ms);
      })
    ]);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    return result;
  } catch (error) {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    throw error;
  }
}

export default async function SuperAdminFinancePage() {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient(
    { cookies: () => cookieStore as any },
    { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_ANON_KEY }
  );

  let redirectTarget: string | null = null;
  let financialData: any = null;

  try {
    const [userRes, isMasterRes, financeRes] = await Promise.allSettled([
      withTimeout(supabase.auth.getUser(), 10000),
      withTimeout(Promise.resolve(supabase.rpc('verify_master_admin_role')), 5000),
      withTimeout(supabase.rpc('get_financial_overview'), 10000)
    ]);

    const user = userRes.status === 'fulfilled' && userRes.value.data ? userRes.value.data.user : null;
    const isMaster = isMasterRes.status === 'fulfilled' ? isMasterRes.value.data : false;
    financialData = financeRes.status === 'fulfilled' && financeRes.value.data ? financeRes.value.data : null;

    if (!user) {
      redirectTarget = '/auth';
    } else if (!isMaster) {
      redirectTarget = '/admin';
    }
  } catch (e) {
    console.error('Error loading Master Admin Finance Page:', e);
    if (!redirectTarget) redirectTarget = '/admin';
  }

  if (redirectTarget) {
    redirect(redirectTarget);
  }

  // Scrub any sensitive data from the retrieved object just in case
  if (financialData) {
    const { gemini_api_key, meta_token, commission_rate, ...cleanData } = financialData;
    financialData = cleanData;
  }

  return <FinanceUI initialData={financialData} />;
}
