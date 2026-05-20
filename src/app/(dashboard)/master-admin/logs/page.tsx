import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AuditLogsPage from '../../admin/audit-logs/page';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function SuperAdminLogsPage() {
  const supabase = createServerComponentClient(
    { cookies },
    { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_ANON_KEY }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  let { data: isMaster } = await supabase.rpc('verify_master_admin_role');
  if (isMaster === null || isMaster === undefined) {
    const { data: isMasterFallback } = await supabase.rpc('is_master_admin');
    isMaster = isMasterFallback;
  }

  if (!isMaster) redirect('/admin');

  return <AuditLogsPage />;
}
