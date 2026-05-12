import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Building2, Users, Calendar, Activity, ShieldAlert, CreditCard } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function withTimeout<T>(
  promise: Promise<T>,
  ms = 5000
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    const result = await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('timeout')), ms)
      })
    ])
    if (timeoutId !== undefined) clearTimeout(timeoutId)
    return result
  } catch (error) {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
    throw error
  }
}

export default async function AgencyDetailsPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createServerComponentClient({ cookies })

  // 1. getUser() + withTimeout
  const { data: { user } } = await withTimeout(supabase.auth.getUser())

  // 2. verify_master_admin_role()
  if (!user || user.user_metadata?.role !== 'master_admin') {
    redirect('/login')
  }

  // Fetch Agency
  const { data: agency } = await withTimeout(
    supabase
      .from('agencies')
      .select('*')
      .eq('id', id)
      .single()
  )

  if (!agency) {
    return <div className="p-6 text-white text-center text-xl mt-10" dir="rtl">الوكالة غير موجودة ⚠️</div>
  }

  // Fetch Tenants Count
  const { count: tenantsCount } = await withTimeout(
    supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', id)
  )

  const currentStatus = agency.subscription_status || agency.status || 'unknown'

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'active': return 'bg-green-500/20 text-green-400'
      case 'suspended': return 'bg-red-500/20 text-red-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  const getStatusText = (status: string) => {
    switch(status) {
      case 'active': return 'نشطة'
      case 'suspended': return 'موقوفة'
      default: return status
    }
  }

  return (
    <div dir="rtl" className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Building2 className="text-blue-400" />
          ملف الوكالة
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* بيانات الوكالة */}
        <div className="lg:col-span-2 bg-gray-800/50 border border-gray-700/50 p-6 rounded-xl space-y-6 shadow-xl">
          <h2 className="text-lg font-semibold text-gray-200 border-b border-gray-700/50 pb-2">التفاصيل الأساسية</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Building2 size={16} /> اسم الوكالة
              </div>
              <div className="text-white font-medium text-lg">{agency.name}</div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <CreditCard size={16} /> الباقة الحالية
              </div>
              <div className="text-blue-400 font-bold uppercase">{agency.plan_type || '—'}</div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Activity size={16} /> الحالة
              </div>
              <div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(currentStatus)}`}>
                  {getStatusText(currentStatus)}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Users size={16} /> عدد العملاء المربوطين
              </div>
              <div className="text-white font-medium">{tenantsCount ?? 0} عميل</div>
            </div>

            <div className="space-y-1 md:col-span-2">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Calendar size={16} /> تاريخ الانضمام
              </div>
              <div className="text-white">
                {agency.created_at ? new Date(agency.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* لوحة التحكم والإجراءات */}
        <div className="bg-gray-800/50 border border-gray-700/50 p-6 rounded-xl flex flex-col justify-start items-center text-center space-y-6 shadow-xl">
          <h2 className="text-lg font-semibold text-gray-200 w-full text-right border-b border-gray-700/50 pb-2">إجراءات الخطر</h2>
          
          <ShieldAlert size={64} className={currentStatus === 'active' ? 'text-orange-400/80' : 'text-green-400/80'} />
          
          <div className="space-y-2">
            <h3 className="text-white font-medium">التحكم في وصول الوكالة</h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              {currentStatus === 'active' 
                ? 'في حال تعطيل الوكالة، سيتم إيقاف جميع العمليات التابعة لها ولن يتمكن عملاؤها من استخدام النظام.' 
                : 'تفعيل الوكالة سيعيد لها كافة الصلاحيات بشكل فوري لاستخدام لوحة التحكم الخاصة بها.'}
            </p>
          </div>
          
          <button
            className={`w-full py-3 rounded-xl font-bold transition-all shadow-lg ${
              currentStatus === 'active' 
                ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-white border border-orange-500/30' 
                : 'bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white border border-green-500/30'
            }`}
          >
            {currentStatus === 'active' ? 'تعطيل الوكالة فوراً' : 'إعادة تفعيل الوكالة'}
          </button>
        </div>

      </div>
    </div>
  )
}
