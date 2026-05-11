import { createRouteHandlerClient }
  from '@supabase/auth-helpers-nextjs'
import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const rateLimitMap = new Map<
  string,
  { count: number; resetAt: number }
>()

function checkRateLimit(
  userId: string
): boolean {
  const now = Date.now()
  const limit = rateLimitMap.get(userId)
  if (!limit || now > limit.resetAt) {
    rateLimitMap.set(userId, {
      count: 1,
      resetAt: now + 60 * 1000
    })
    return true
  }
  if (limit.count >= 10) return false
  limit.count++
  return true
}

async function withTimeout(
  promise: Promise<any>,
  ms = 5000
): Promise<any> {
  let timeoutId: ReturnType<
    typeof setTimeout
  > | undefined
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

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({
      cookies
    })

    const { data: { user }, error: authError } =
      await withTimeout(
        supabase.auth.getUser(), 3000
      )

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (user.user_metadata?.role
      !== 'master_admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      )
    }

    let body: unknown
    try {
      body = await withTimeout(
        req.json(), 3000
      )
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const agencyId =
      (body as Record<string, unknown>)
        ?.agencyId

    if (
      typeof agencyId !== 'string'
      || !UUID_REGEX.test(agencyId)
    ) {
      return NextResponse.json(
        { error: 'Invalid agency ID' },
        { status: 400 }
      )
    }

    const { data: agency, error: fetchError } =
      await withTimeout(
        supabase
          .from('agencies')
          .select('id, status, name')
          .eq('id', agencyId)
          .single(),
        3000
      )

    if (fetchError || !agency) {
      return NextResponse.json(
        { error: 'Agency not found' },
        { status: 404 }
      )
    }

    if (agency.status !== 'active') {
      return NextResponse.json(
        { error: 'Agency is not active' },
        { status: 409 }
      )
    }

    const { count: activeTenantsCount } =
      await withTimeout(
        supabase
          .from('tenants')
          .select('id', {
            count: 'exact',
            head: true
          })
          .eq('agency_id', agencyId)
          .eq('status', 'active'),
        3000
      )

    const { error: updateError } =
      await withTimeout(
        supabase
          .from('agencies')
          .update({
            status: 'suspended',
            suspended_at:
              new Date().toISOString(),
            suspended_by: user.id
          })
          .eq('id', agencyId)
          .eq('status', 'active'),
        3000
      )

    if (updateError) {
      console.error('[SUSPEND] update_failed')
      return NextResponse.json(
        { error: 'Update failed' },
        { status: 500 }
      )
    }

    const headersList = headers()
    await supabase
      .from('audit_logs')
      .insert({
        actor_id: user.id,
        action_type: 'SUSPEND_AGENCY',
        entity_type: 'agency',
        entity_id: agencyId,
        changes: {
          agency_id: agencyId,
          agency_name: agency.name,
          status_before: 'active',
          status_after: 'suspended',
          active_tenants_count:
            activeTenantsCount ?? 0,
          ip_address:
            headersList.get('x-forwarded-for')
            ?? 'unknown',
          user_agent:
            headersList.get('user-agent')
            ?? 'unknown',
          timestamp: new Date().toISOString()
        }
      })

    return NextResponse.json(
      {
        success: true,
        agencyId,
        suspendedAt: new Date().toISOString()
      },
      { status: 200 }
    )

  } catch {
    console.error('[SUSPEND] internal_error')
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    )
  }
}
