import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ClientDashboard from '@/components/dashboard/ClientDashboard';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient(
    { cookies: () => cookieStore as any },
    { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_ANON_KEY }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  // Check if master admin
  let isMaster = false;
  try {
    const { data } = await supabase.rpc('verify_master_admin_role');
    if (data) {
      isMaster = true;
    } else {
      const { data: fallbackData } = await supabase.rpc('is_master_admin');
      isMaster = !!fallbackData;
    }
  } catch (e) {
    // Ignore
  }

  if (isMaster) {
    redirect('/master-admin');
  }

  return <ClientDashboard />;
}

