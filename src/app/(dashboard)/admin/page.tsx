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
