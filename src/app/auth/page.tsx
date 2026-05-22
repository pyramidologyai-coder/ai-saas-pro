'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
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

  React.useEffect(() => {
    const checkActiveSession = async () => {
      const supabaseClient = createClientComponentClient({
        supabaseUrl: SUPABASE_URL,
        supabaseKey: SUPABASE_ANON_KEY
      });
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.user) {
        const user = session.user;
        const isMasterMetadata = user.user_metadata?.role === 'master_admin';
        
        const superAdminEmails = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || '')
          .split(',')
          .map(e => e.trim().toLowerCase())
          .filter(Boolean);
        
        if (superAdminEmails.length === 0) {
          superAdminEmails.push('pyramidology.ai@gmail.com', 'ashsameh1@gmail.com');
        }
        const isSuperAdminEmail = user.email && superAdminEmails.includes(user.email.toLowerCase());

        let isMaster = false;
        try {
          const { data } = await supabaseClient.rpc('verify_master_admin_role');
          if (data) {
            isMaster = true;
          } else {
            const { data: fallbackData } = await supabaseClient.rpc('is_master_admin');
            isMaster = !!fallbackData;
          }
        } catch (e) {
          // Ignore
        }

        if (isMaster || isMasterMetadata || isSuperAdminEmail) {
          router.replace('/master-admin');
        } else {
          router.replace('/admin');
        }
      }
    };
    checkActiveSession();
  }, [router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const supabaseClient = createClientComponentClient({
      supabaseUrl: SUPABASE_URL,
      supabaseKey: SUPABASE_ANON_KEY
    });

    try {
      if (isLogin) {
        // LOGIN
        const { data: authData, error } = await supabaseClient.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        const user = authData?.user;
        const isMasterMetadata = user?.user_metadata?.role === 'master_admin';
        
        // Direct local check of super admin emails to avoid any latency or race conditions
        const superAdminEmails = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || '')
          .split(',')
          .map(e => e.trim().toLowerCase())
          .filter(Boolean);
        
        if (superAdminEmails.length === 0) {
          superAdminEmails.push('pyramidology.ai@gmail.com', 'ashsameh1@gmail.com');
        }
        const isSuperAdminEmail = user?.email && superAdminEmails.includes(user.email.toLowerCase());

        // Direct check for master admin role to avoid flash (RPC backup)
        let isMaster = false;
        try {
          const { data } = await supabaseClient.rpc('verify_master_admin_role');
          if (data) {
            isMaster = true;
          } else {
            const { data: fallbackData } = await supabaseClient.rpc('is_master_admin');
            isMaster = !!fallbackData;
          }
        } catch (e) {
          // Ignore
        }

        if (isMaster || isMasterMetadata || isSuperAdminEmail) {
          router.replace('/master-admin');
        } else {
          router.replace('/admin');
        }
      } else {
        // SIGNUP
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              business_name: businessName || 'My Business',
              business_type: businessType
            }
          }
        });
        if (authError) throw authError;

        if (authData.user && authData.session) {
          router.push('/admin');
        } else if (authData.user && !authData.session) {
          alert('تم إنشاء الحساب بنجاح! يرجى مراجعة بريدك الإلكتروني لتأكيد الحساب قبل تسجيل الدخول.');
        }
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.message || '';
      if (msg.toLowerCase().includes('invalid login credentials') || msg.toLowerCase().includes('invalid credentials')) {
        setErrorMsg('بيانات الدخول غير صحيحة. تأكد من الإيميل وكلمة المرور، أو تحقق من بريدك الإلكتروني لتأكيد الحساب أولاً.');
      } else if (msg.toLowerCase().includes('email not confirmed')) {
        setErrorMsg('يرجى تأكيد بريدك الإلكتروني أولاً — تحقق من رسالة التأكيد في إيميلك.');
      } else {
        setErrorMsg(msg || 'حدث خطأ أثناء تسجيل الدخول');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const supabaseClient = createClientComponentClient({
      supabaseUrl: SUPABASE_URL,
      supabaseKey: SUPABASE_ANON_KEY
    });
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth`
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'حدث خطأ أثناء الدخول بحساب جوجل');
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

        <button 
          type="button" 
          onClick={handleGoogleLogin} 
          className={styles.googleBtn} 
          disabled={loading}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          الدخول باستخدام جوجل (Google)
        </button>

        <div className={styles.divider}>
          <span>أو بالبريد الإلكتروني</span>
        </div>

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
                  <select 
                    className={styles.input}
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  >
                    <option value="clinic">عيادات ومراكز طبية</option>
                    <option value="real_estate">شركات عقارية (Brokers)</option>
                    <option value="salon">مراكز تجميل وسبا</option>
                    <option value="car_rental">معارض وإيجار سيارات</option>
                    <option value="ecommerce">متاجر إلكترونية</option>
                    <option value="restaurant">مطاعم وكافيهات</option>
                  </select>
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
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              كلمة المرور
              {isLogin && (
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
                  onClick={async () => {
                    if (!email) { setErrorMsg('أدخل الإيميل أولاً'); return; }
                    const supabaseClient = createClientComponentClient({
                      supabaseUrl: SUPABASE_URL,
                      supabaseKey: SUPABASE_ANON_KEY
                    });
                    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/auth/reset-password`
                    });
                    if (error) { setErrorMsg(error.message); return; }
                    setErrorMsg('');
                    alert('تم إرسال رابط إعادة تعيين كلمة المرور على بريدك الإلكتروني');
                  }}
                >
                  نسيت كلمة المرور؟
                </button>
              )}
            </label>
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
