import { createRouteHandlerClient }
  from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AgencyDetailsUI }
  from '@/components/agencies/AgencyDetailsUI'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase'
import type { SupabaseClient }
  from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const VALID_LANGS = ['ar', 'en', 'fr'] as const
type Lang = typeof VALID_LANGS[number]

async function withTimeout<T>(
  promise: Promise<T> | PromiseLike<T>,
  ms = 5000
): Promise<Awaited<T>> {
  let timeoutId: ReturnType<
    typeof setTimeout
  > | undefined = undefined
  try {
    const result = await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('timeout')),
          ms
        )
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

async function checkAuth(
  supabase: SupabaseClient
): Promise<boolean> {
  try {
    const { data, error } =
      await withTimeout(
        supabase.auth.getUser(), 10000
      )
    return !error && !!data.user
  } catch { return false }
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

export default async function AgencyPage({
  params,
  searchParams
}: {
  params: { id: string }
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

  const agencyId = params.id
  if (
    typeof agencyId !== 'string'
    || !UUID_REGEX.test(agencyId)
  ) {
    redirect('/master-admin/agencies')
  }

  const [userRes, isMasterRes, agencyRes, commissionRes, tenantsRes] = await Promise.allSettled([
    withTimeout(supabase.auth.getUser(), 10000),
    withTimeout(Promise.resolve(supabase.rpc('verify_master_admin_role')), 5000),
    withTimeout(
      supabase
        .from('agencies')
        .select(`
          id,
          name,
          contact_email,
          plan_type,
          subscription_status,
          subscription_end_date,
          created_at,
          whatsapp_number,
          messages_used,
          messages_limit,
          custom_domain,
          logo_url
        `)
        .eq('id', agencyId)
        .single(),
      5000
    ),
    withTimeout(
      supabase.rpc(
        'get_agency_commission',
        { p_agency_id: agencyId }
      ),
      3000
    ),
    withTimeout(
      supabase
        .from('tenants')
        .select('id', {
          count: 'exact',
          head: true
        })
        .eq('agency_id', agencyId),
      5000
    )
  ]);

  const user = userRes.status === 'fulfilled' && userRes.value.data ? userRes.value.data.user : null;
  const isMaster = isMasterRes.status === 'fulfilled' ? isMasterRes.value.data : false;

  if (!user || !isMaster) {
    redirect('/auth')
  }

  const agency = agencyRes.status === 'fulfilled' && agencyRes.value.data ? agencyRes.value.data : null;
  if (!agency) {
    redirect('/master-admin/agencies')
  }

  let commissionRate = 0;
  if (commissionRes.status === 'fulfilled') {
    const commData = commissionRes.value.data;
    if (typeof commData === 'number' && !isNaN(commData) && isFinite(commData)) {
      commissionRate = Math.max(0, commData);
    }
  }

  let tenantsCount = 0;
  if (tenantsRes.status === 'fulfilled' && !tenantsRes.value.error && tenantsRes.value.count !== null) {
    tenantsCount = tenantsRes.value.count;
  }

  const rawLang = searchParams?.lang ?? 'ar'
  const lang: Lang = VALID_LANGS.includes(
    rawLang as Lang
  ) ? rawLang as Lang : 'ar'

  return (
    <AgencyDetailsUI
      agency={agency}
      tenantsCount={tenantsCount}
      commissionRate={commissionRate}
      initialLang={lang}
    />
  )
}
