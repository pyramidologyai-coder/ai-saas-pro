'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Store, KeyRound, Clock, ArrowRight, ArrowLeft } from 'lucide-react';
import styles from './Onboarding.module.css';
import { createClient } from '@/utils/supabase/client';

export default function OnboardingWizard() {
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // أول ما يفتح الـ Onboarding: تحقق لو الـ tenant موجود فعلاً
  React.useEffect(() => {
    const checkExisting = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: existingTenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1);
      
      if (existingTenant && existingTenant.length > 0) {
        router.replace('/admin');
      }
    };
    checkExisting();
  }, [router]);

  const [formData, setFormData] = useState({
    name: '',
    type: 'clinic',
    whatsapp_number_id: '',
    meta_token: '',
    start_time: '10:00',
    end_time: '22:00',
    duration: '30'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNext = async () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 7);

        const searchParams = new URLSearchParams(window.location.search);
        const agencyId = searchParams.get('agency_id');
        let validAgencyId = null;

        if (agencyId) {
          // SECURITY FIX: Verify Agency ID is real and active
          const { data: agencyCheck } = await supabase
            .from('agencies')
            .select('id, subscription_status')
            .eq('id', agencyId)
            .single();
            
          if (agencyCheck && agencyCheck.subscription_status === 'active') {
            validAgencyId = agencyCheck.id;
          } else {
            alert('رابط الوكالة المرفق غير صالح أو موقوف. سيتم تسجيل الحساب كعميل مباشر.');
          }
        }

        // تحقق إضافي بطريقة تتجنب الـ 406
        const { data: existingTenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('user_id', session.user.id)
          .limit(1);

        let newTenant = null;
        let insertError = null;

        const tenantData = {
          user_id: session.user.id,
          agency_id: validAgencyId,
          name: formData.name || 'نشاط تجاري جديد',
          type: formData.type,
          whatsapp_number_id: formData.whatsapp_number_id,
          meta_token: formData.meta_token,
          working_hours: `يومياً من ${formData.start_time} إلى ${formData.end_time}`,
          trial_ends_at: trialEndsAt.toISOString(),
          slug: 'b-' + Math.floor(Math.random() * 100000)
        };

        if (existingTenant && existingTenant.length > 0) {
          const res = await supabase.from('tenants').update(tenantData).eq('id', existingTenant[0].id).select().single();
          newTenant = res.data;
          insertError = res.error;
        } else {
          const res = await supabase.from('tenants').insert(tenantData).select().single();
          newTenant = res.data;
          insertError = res.error;
        }

        if (insertError) {
          console.error("INSERT ERROR DETAILS:", insertError);
          alert('حدث خطأ أثناء الحفظ. افتح الـ Console وشوف الخطأ.');
          throw insertError;
        }
        
        if (newTenant) {
          localStorage.setItem('active_tenant_id', newTenant.id);
        }
        
        router.push('/admin');
      } catch (e) {
        console.error("GENERAL ERROR:", e);
        alert('حدث خطأ. يرجى مراجعة الـ Console للتفاصيل.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className={styles.container} dir="rtl">
      <div className={styles.bgGlow}></div>
      
      <div className={styles.wizardCard}>
        <div className={styles.header}>
          <h1 className={styles.title}>مرحباً بك في عيادتك الذكية! 🎉</h1>
          <p className={styles.subtitle}>لنبقِ الأمور بسيطة.. 3 خطوات سريعة فقط لإعداد مساعدك الذكي.</p>
        </div>

        {/* Stepper */}
        <div className={styles.stepper}>
          <div className={`${styles.step} ${step >= 1 ? styles.active : ''} ${step > 1 ? styles.completed : ''}`}>
            {step > 1 ? <Check size={24} /> : <Store size={24} />}
          </div>
          <div className={`${styles.step} ${step >= 2 ? styles.active : ''} ${step > 2 ? styles.completed : ''}`}>
            {step > 2 ? <Check size={24} /> : <KeyRound size={24} />}
          </div>
          <div className={`${styles.step} ${step >= 3 ? styles.active : ''}`}>
            {step > 3 ? <Check size={24} /> : <Clock size={24} />}
          </div>
        </div>

        {/* Step 1: Clinic Info */}
        {step === 1 && (
          <div className={styles.stepContent}>
            <h2 className={styles.label} style={{ fontSize: '1.4rem', marginBottom: '1.5rem', color: 'var(--accent-primary)' }}>
              الخطوة الأولى: بيانات النشاط
            </h2>
            <div className={styles.inputGroup}>
              <label className={styles.label}>اسم النشاط التجاري</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} className={styles.input} placeholder="مثال: عيادة الأمل / مطعم كرم / معرض سيارات" />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>مجال النشاط (الصناعة)</label>
              <select name="type" value={formData.type} onChange={handleChange} className={styles.input}>
                <option value="clinic">عيادات ومراكز طبية</option>
                <option value="real_estate">شركات عقارية (Brokers)</option>
                <option value="salon">مراكز تجميل وسبا</option>
                <option value="car_rental">معارض وإيجار سيارات</option>
                <option value="ecommerce">متاجر إلكترونية</option>
                <option value="restaurant">مطاعم وكافيهات</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Meta API */}
        {step === 2 && (
          <div className={styles.stepContent}>
            <h2 className={styles.label} style={{ fontSize: '1.4rem', marginBottom: '0.5rem', color: 'var(--accent-primary)' }}>
              الخطوة الثانية: ربط الواتساب
            </h2>
            <p className={styles.subtitle} style={{ marginBottom: '2rem' }}>
              لكي يتمكن المساعد الذكي من التحدث مع مرضاك، قم بلصق مفاتيح Meta API الخاصة بك هنا.
            </p>
            <div className={styles.inputGroup}>
              <label className={styles.label}>WhatsApp Phone Number ID</label>
              <input type="text" name="whatsapp_number_id" value={formData.whatsapp_number_id} onChange={handleChange} className={styles.input} placeholder="مثال: 123456789012345" />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Permanent Access Token</label>
              <input type="password" name="meta_token" value={formData.meta_token} onChange={handleChange} className={styles.input} placeholder="EAA..." />
            </div>
          </div>
        )}

        {/* Step 3: Hours */}
        {step === 3 && (
          <div className={styles.stepContent}>
            <h2 className={styles.label} style={{ fontSize: '1.4rem', marginBottom: '0.5rem', color: 'var(--accent-primary)' }}>
              الخطوة الأخيرة: مواعيد العمل
            </h2>
            <p className={styles.subtitle} style={{ marginBottom: '2rem' }}>
              حدد المواعيد المتاحة ليقوم المساعد الذكي بحجزها للمرضى تلقائياً.
            </p>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <div className={styles.inputGroup} style={{ flex: 1 }}>
                <label className={styles.label}>بدء العمل (من الساعة)</label>
                <input type="time" name="start_time" value={formData.start_time} onChange={handleChange} className={styles.input} />
              </div>
              <div className={styles.inputGroup} style={{ flex: 1 }}>
                <label className={styles.label}>انتهاء العمل (إلى الساعة)</label>
                <input type="time" name="end_time" value={formData.end_time} onChange={handleChange} className={styles.input} />
              </div>
            </div>
            
            <div className={styles.inputGroup} style={{ marginTop: '1rem' }}>
              <label className={styles.label}>مدة الخدمة/المقابلة التقريبية</label>
              <select name="duration" value={formData.duration} onChange={handleChange} className={styles.input}>
                <option value="15">15 دقيقة</option>
                <option value="30">30 دقيقة</option>
                <option value="45">45 دقيقة</option>
                <option value="60">ساعة كاملة</option>
              </select>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className={styles.buttons}>
          {step > 1 && (
            <button className={styles.prevBtn} onClick={handlePrev}>
              <ArrowRight size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              الخطوة السابقة
            </button>
          )}
          <button className={styles.nextBtn} onClick={handleNext} disabled={loading}>
            {loading ? 'جاري الحفظ...' : (step === 3 ? 'إنهاء وحفظ البيانات' : 'الخطوة التالية')}
            {step !== 3 && <ArrowLeft size={18} style={{ marginLeft: '8px', verticalAlign: 'middle' }} />}
          </button>
        </div>
      </div>
    </div>
  );
}
