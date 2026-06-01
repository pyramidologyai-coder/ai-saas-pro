import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import ClientDashboard from '@/components/dashboard/ClientDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  // Check master and agency roles in parallel to minimize network latency
  const [masterRes, agencyRes] = await Promise.all([
    supabase.rpc('verify_master_admin_role'),
    supabase
      .from('agencies')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
  ]);

  const isMaster = !!masterRes.data;
  const isAgency = !!(agencyRes.data && agencyRes.data.length > 0);

  if (isMaster) {
    redirect('/master-admin');
  }

  if (isAgency) {
    redirect('/agency-admin');
  }

  return <ClientDashboard />;
}
