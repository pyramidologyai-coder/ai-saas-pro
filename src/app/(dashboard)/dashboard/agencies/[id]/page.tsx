import { createServerComponentClient }
  from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AgencyDetailsUI }
  from '@/components/agencies/AgencyDetailsUI'
import type { SupabaseClient }
  from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const VALID_LANGS = ['ar', 'en', 'fr'] as const
type Lang = typeof VALID_LANGS[number]

async function withTimeout<T>(
  promise: Promise<T>,
  ms = 5000
): Promise<T> {
  let timeoutId: ReturnType<
    typeof setTimeout
  > | undefined = undefined
  try {
    const result = await Promise.race([
      promise,
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
        supabase.auth.getUser(), 3000
      )
    return !error && !!data.user
  } catch { return false }
}

async function checkMasterRole(
  supabase: SupabaseClient
): Promise<boolean> {
  try {
    const result = await withTimeout(
      supabase.rpc('verify_master_admin_role'),
      3000
    ) as { data: boolean | null; error: unknown }
    return !result.error && !!result.data
  } catch { return false }
}

export default async function AgencyPage({
  params,
  searchParams
}: {
  params: { id: string }
  searchParams: { lang?: string }
}) {
  const supabase = createServerComponentClient({
    cookies
  })

  const isAuthenticated = await checkAuth(supabase)
  if (!isAuthenticated) redirect('/login')

  const isMasterAdmin =
    await checkMasterRole(supabase)
  if (!isMasterAdmin) redirect('/login')

  const agencyId = params.id
  if (
    typeof agencyId !== 'string'
    || !UUID_REGEX.test(agencyId)
  ) {
    redirect('/dashboard/agencies')
  }

  const rawLang = searchParams?.lang ?? 'ar'
  const lang: Lang = VALID_LANGS.includes(
    rawLang as Lang
  ) ? rawLang as Lang : 'ar'

  let agency: Record<string, unknown> | null = null
  let agencyError = false

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('agencies')
        .select(`
          id,
          name,
          plan_type,
          subscription_status,
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
    )
    if (error || !data) {
      agencyError = true
    } else {
      agency = data
    }
  } catch {
    agencyError = true
  }

  if (agencyError || !agency) {
    redirect('/dashboard/agencies')
  }

  let commissionRate = 0
  try {
    const { data } = await withTimeout(
      supabase.rpc(
        'get_agency_commission',
        { p_agency_id: agencyId }
      ),
      3000
    )
    if (typeof data === 'number'
      && !isNaN(data)
      && isFinite(data)) {
      commissionRate = Math.max(0, data)
    }
  } catch {
    commissionRate = 0
  }

  let tenantsCount = 0
  try {
    const { count, error } = await withTimeout(
      supabase
        .from('tenants')
        .select('id', {
          count: 'exact',
          head: true
        })
        .eq('agency_id', agencyId),
      5000
    )
    if (!error && count !== null) {
      tenantsCount = count
    }
  } catch {
    tenantsCount = 0
  }

  return (
    <AgencyDetailsUI
      agency={agency!}
      tenantsCount={tenantsCount}
      commissionRate={commissionRate}
      initialLang={lang}
    />
  )
}
