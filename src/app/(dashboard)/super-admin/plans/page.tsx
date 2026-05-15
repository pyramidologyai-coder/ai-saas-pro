import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { PlansUI } from '@/components/super-admin/PlansUI'
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
    const { data, error } = await withTimeout(supabase.auth.getUser(), 3000)
    return !error && !!data.user
  } catch {
    return false
  }
}

async function checkMasterRole(supabase: SupabaseClient): Promise<boolean> {
  let isMasterByRpc = false
  try {
    const { data } = await supabase.rpc('is_master_admin').throwOnError()
    isMasterByRpc = !!data
  } catch {
    // Ignore RPC error
  }

  if (isMasterByRpc) return true

  // Fallback to Env variable check
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const userEmail = (user?.email || '').toLowerCase()
    const superAdminEmails = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || '')
      .replace(/[^\x20-\x7E]/g, '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)
      
    return superAdminEmails.includes(userEmail)
  } catch {
    return false
  }
}

export default async function PlansPage({
  searchParams
}: {
  searchParams: { lang?: string }
}) {
  const supabase = createServerComponentClient({ 
    cookies,
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_ANON_KEY
  })

  const [isAuthenticated, isMasterAdmin] = await Promise.allSettled([
    checkAuth(supabase),
    checkMasterRole(supabase)
  ])

  const isAuth = isAuthenticated.status === 'fulfilled' && isAuthenticated.value
  const isMaster = isMasterAdmin.status === 'fulfilled' && isMasterAdmin.value

  if (!isAuth || !isMaster) {
    redirect('/auth')
  }

  const rawLang = searchParams?.lang ?? 'ar'
  const lang: Lang = VALID_LANGS.includes(rawLang as Lang) ? (rawLang as Lang) : 'ar'

  let plans: any[] = []
  let fetchError = false

  try {
    // 1. Fetch plans with stats via RPC
    // 2. Fetch plan features
    const [plansRes, featuresRes] = await Promise.allSettled([
      withTimeout(supabase.rpc('get_plans_with_stats'), 5000),
      withTimeout(supabase.from('plan_features').select('*'), 5000)
    ])

    if (plansRes.status === 'fulfilled' && !plansRes.value.error) {
      plans = plansRes.value.data || []
    } else {
      fetchError = true
    }

    // Merge features into plans
    if (featuresRes.status === 'fulfilled' && !featuresRes.value.error && featuresRes.value.data) {
      const features = featuresRes.value.data
      plans = plans.map(p => ({
        ...p,
        features: features.filter((f: any) => f.plan_id === p.id)
      }))
    }
  } catch {
    fetchError = true
  }

  if (fetchError && plans.length === 0) {
    // Graceful fallback or ignore since PlansUI will handle empty arrays
  }

  return <PlansUI initialPlans={plans} initialLang={lang} />
}
