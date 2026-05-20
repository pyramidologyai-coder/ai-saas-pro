import { PlanEditor } from '@/components/plans/PlanEditor';

export default function MasterAdminPlansPage() {
  return (
    <div className="max-w-6xl mx-auto p-6" dir="rtl">
      <h1 className="text-3xl font-bold mb-6">إعدادات الباقات الشاملة (Master Admin)</h1>
      <p className="text-gray-500 mb-6">هذه الصفحة خاصة بمالك المنصة للتحكم في أسعار الباقات الأساسية وحدود الاستخدام.</p>
      <PlanEditor />
    </div>
  );
}
