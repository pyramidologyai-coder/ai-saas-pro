import { AgencyPlanEditor } from '@/components/plans/AgencyPlanEditor';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AgencyPlansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  const [{ data: isMaster }, { data: agency }] = await Promise.all([
    supabase.rpc('verify_master_admin_role'),
    supabase.from('agencies').select('id').eq('user_id', user.id).maybeSingle(),
  ]);

  if (!isMaster && !agency) {
    redirect('/admin');
  }

  return (
    <div className="max-w-6xl mx-auto p-6" dir="rtl">
      <h1 className="text-3xl font-bold mb-6">إدارة أسعار الاشتراكات لعملائك (Super Admin)</h1>
      <p className="text-gray-500 mb-6">يمكنك هنا تحديد أسعار بيع الباقات لعملائك. لا يمكن أن يقل السعر عن السعر الأساسي للماستر.</p>
      <AgencyPlanEditor />
    </div>
  );
}
