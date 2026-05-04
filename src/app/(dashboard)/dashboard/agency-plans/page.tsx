import { AgencyPlanEditor } from '@/components/plans/AgencyPlanEditor';

export default function AgencyPlansPage() {
  return (
    <div className="max-w-6xl mx-auto p-6" dir="rtl">
      <h1 className="text-3xl font-bold mb-6">إدارة أسعار الاشتراكات لعملائك (Super Admin)</h1>
      <p className="text-gray-500 mb-6">يمكنك هنا تحديد أسعار بيع الباقات لعملائك. لا يمكن أن يقل السعر عن السعر الأساسي للماستر.</p>
      <AgencyPlanEditor />
    </div>
  );
}
