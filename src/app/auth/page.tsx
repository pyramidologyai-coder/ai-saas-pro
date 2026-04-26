'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from './Auth.module.css';
import { Building2, Stethoscope, Mail, Lock, Store } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('clinic');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (isLogin) {
        // LOGIN
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push('/dashboard');
      } else {
        // SIGNUP
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (authError) throw authError;

        if (authData.user) {
          // Calculate 7 days from now for the trial period
          const trialEndsAt = new Date();
          trialEndsAt.setDate(trialEndsAt.getDate() + 7);

          // Create tenant record linked to this user
          const { error: tenantError } = await supabase.from('tenants').insert({
            user_id: authData.user.id,
            name: businessName || 'My Business',
            type: businessType,
            trial_ends_at: trialEndsAt.toISOString(),
            slug: businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Math.floor(Math.random() * 1000)
          });
          if (tenantError) throw tenantError;
          
          router.push('/dashboard');
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <Building2 size={32} color="var(--accent-primary)" />
          </div>
          <h1>{isLogin ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}</h1>
          <p>{isLogin ? 'مرحباً بعودتك! أدخل بياناتك للوصول للوحة التحكم.' : 'ابدأ الآن في إدارة نشاطك التجاري بالذكاء الاصطناعي.'}</p>
        </div>

        {errorMsg && <div className={styles.error}>{errorMsg}</div>}

        <form onSubmit={handleAuth} className={styles.form}>
          {!isLogin && (
            <>
              <div className={styles.inputGroup}>
                <label>اسم النشاط التجاري</label>
                <div className={styles.inputWrapper}>
                  <Building2 size={18} className={styles.inputIcon} />
                  <input 
                    type="text" 
                    placeholder="مثال: عيادة الأمل، أو مطعم كرم"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required={!isLogin}
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>نوع النشاط التجاري</label>
                <div className={styles.typeSelector}>
                  <button 
                    type="button"
                    className={`${styles.typeBtn} ${businessType === 'clinic' ? styles.active : ''}`}
                    onClick={() => setBusinessType('clinic')}
                  >
                    <Stethoscope size={20} />
                    عيادة طبية
                  </button>
                  <button 
                    type="button"
                    className={`${styles.typeBtn} ${businessType === 'restaurant' ? styles.active : ''}`}
                    onClick={() => setBusinessType('restaurant')}
                  >
                    <Store size={20} />
                    مطعم / كافيه
                  </button>
                </div>
              </div>
            </>
          )}

          <div className={styles.inputGroup}>
            <label>البريد الإلكتروني</label>
            <div className={styles.inputWrapper}>
              <Mail size={18} className={styles.inputIcon} />
              <input 
                type="email" 
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label>كلمة المرور</label>
            <div className={styles.inputWrapper}>
              <Lock size={18} className={styles.inputIcon} />
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'جاري المعالجة...' : (isLogin ? 'دخول للوحة التحكم' : 'إنشاء حسابي')}
          </button>
        </form>

        <div className={styles.footer}>
          {isLogin ? (
            <p>ليس لديك حساب؟ <button type="button" onClick={() => setIsLogin(false)}>سجل مجاناً الآن</button></p>
          ) : (
            <p>لديك حساب بالفعل؟ <button type="button" onClick={() => setIsLogin(true)}>تسجيل الدخول</button></p>
          )}
        </div>
      </div>
    </div>
  );
}
