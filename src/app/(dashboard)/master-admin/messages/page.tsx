import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MessagesPage from '../../messages/page';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function SuperAdminMessagesPage() {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient(
    { cookies: () => cookieStore as any },
    { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_ANON_KEY }
  );

  const [userRes, isMasterRes] = await Promise.allSettled([
    supabase.auth.getUser(),
    supabase.rpc('verify_master_admin_role')
  ]);

  const user = userRes.status === 'fulfilled' ? userRes.value.data.user : null;
  const isMaster = isMasterRes.status === 'fulfilled' ? isMasterRes.value.data : false;

  if (!user) redirect('/auth');
  if (!isMaster) redirect('/admin');

  return <MessagesPage />;
}
