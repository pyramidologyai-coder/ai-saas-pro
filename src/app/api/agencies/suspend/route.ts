import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

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
  promise: any,
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
    const supabase = await createClient();

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

    const { data: isMaster } = await withTimeout(
      Promise.resolve(supabase.rpc('verify_master_admin_role')),
      3000
    )

    if (!isMaster) {
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
          .select('id, subscription_status, name')
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

    if (agency.subscription_status === 'suspended') {
      return NextResponse.json(
        { error: 'Agency is already suspended' },
        { status: 409 }
      )
    }

    const { data, error: rpcError } = await withTimeout(
      Promise.resolve(supabase.rpc('suspend_agency_cascade', { 
        p_agency_id: agencyId 
      })),
      5000
    )

    if (rpcError || !data?.success) {
      console.error('[SUSPEND] rpc_failed', rpcError)
      return NextResponse.json(
        { error: data?.error || 'Update failed' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        agencyId,
        suspendedAt: new Date().toISOString(),
        tenantsSuspended: data.tenants_suspended
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
