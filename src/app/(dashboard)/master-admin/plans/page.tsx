import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { PlansUI } from '@/components/master-admin/PlansUI'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const VALID_LANGS = ['ar', 'en', 'fr'] as const
type Lang = typeof VALID_LANGS[number]

async function withTimeout<T>(
  promise: Promise<T> | PromiseLike<T>,
  ms = 5000
): Promise<Awaited<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined
  try {
    const result = await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('timeout')), ms)
      })
    ])
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
    return result
  } catch (error) {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
    throw error
  }
}

async function checkAuth(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await withTimeout(supabase.auth.getUser(), 10000)
    return !error && !!data.user
  } catch {
    return false
  }
}

async function checkMasterRole(
  supabase: SupabaseClient
): Promise<boolean> {
  try {
    const [verifyRes, isMasterRes] = await Promise.allSettled([
      supabase.rpc('verify_master_admin_role'),
      supabase.rpc('is_master_admin')
    ]);

    const verifyData = verifyRes.status === 'fulfilled' ? verifyRes.value.data : null;
    const fallbackData = isMasterRes.status === 'fulfilled' ? isMasterRes.value.data : null;

    if (verifyData || fallbackData) return true;
    
    const { data: { user } } = await supabase.auth.getUser();
    return user?.user_metadata?.role === 'master_admin';
  } catch {
    return false
  }
}

export default async function PlansPage({
  searchParams
}: {
  searchParams: { lang?: string }
}) {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient(
    { cookies: () => cookieStore as any },
    {
      supabaseUrl: SUPABASE_URL,
      supabaseKey: SUPABASE_ANON_KEY
    }
  )

  const [userRes, isMasterRes, plansStatsRes, plansTableRes, featuresRes] = await Promise.allSettled([
    withTimeout(supabase.auth.getUser(), 10000),
    withTimeout(Promise.resolve(supabase.rpc('verify_master_admin_role')), 5000),
    withTimeout(supabase.rpc('get_plans_with_stats'), 5000),
    withTimeout(supabase.from('plans').select('*'), 5000),
    withTimeout(supabase.from('plan_features').select('*'), 5000)
  ]);

  const user = userRes.status === 'fulfilled' && userRes.value.data ? userRes.value.data.user : null;
  const isMaster = isMasterRes.status === 'fulfilled' ? isMasterRes.value.data : false;

  if (!user || !isMaster) {
    redirect('/auth')
  }

  const rawLang = searchParams?.lang ?? 'ar'
  const lang: Lang = VALID_LANGS.includes(rawLang as Lang) ? (rawLang as Lang) : 'ar'

  let plans: any[] = []

  const statsList = plansStatsRes.status === 'fulfilled' && !(plansStatsRes.value as any).error ? (plansStatsRes.value as any).data || [] : [];
  const rawPlans = plansTableRes.status === 'fulfilled' && !(plansTableRes.value as any).error ? (plansTableRes.value as any).data || [] : [];

  plans = rawPlans.map((rp: any) => {
    const stats = statsList.find((s: any) => s.id === rp.id) || {};
    return {
      ...rp,
      agencies_count: stats.agencies_count || 0,
      revenue: stats.revenue || 0
    };
  });

  if (featuresRes.status === 'fulfilled' && !featuresRes.value.error && featuresRes.value.data) {
    const features = featuresRes.value.data
    plans = plans.map(p => ({
      ...p,
      features: features.filter((f: any) => f.plan_id === p.id)
    }))
  }

  return <PlansUI initialPlans={plans} initialLang={lang} />
}
