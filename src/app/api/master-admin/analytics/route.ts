import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();

    // 1. Verify Authentication
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify Master Admin Role
    const { data: isMaster } = await supabase.rpc('verify_master_admin_role');
    if (!isMaster) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // 3. Parse query params
    const url = new URL(req.url);
    const daysParam = url.searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 30;

    // 4. Call Database RPC
    const { data: analyticsData, error: analyticsError } = await supabase.rpc(
      'get_channel_analytics',
      { p_days: days }
    );

    if (analyticsError) {
      console.error('Error calling get_channel_analytics RPC:', analyticsError);
      return NextResponse.json({ error: analyticsError.message }, { status: 500 });
    }

    return NextResponse.json({ data: analyticsData });
  } catch (error: any) {
    console.error('Master Admin Analytics API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
