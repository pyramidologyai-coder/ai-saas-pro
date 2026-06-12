import { PlanEditor } from '@/components/plans/PlanEditor';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function MasterAdminPlansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  const { data: isMaster } = await supabase.rpc('verify_master_admin_role');
  if (!isMaster) {
    redirect('/admin');
  }

  return (
    <div className="max-w-6xl mx-auto p-6" dir="rtl">
      <h1 className="text-3xl font-bold mb-6">إعدادات الباقات الشاملة (Master Admin)</h1>
      <p className="text-gray-500 mb-6">هذه الصفحة خاصة بمالك المنصة للتحكم في أسعار الباقات الأساسية وحدود الاستخدام.</p>
      <PlanEditor />
    </div>
  );
}
