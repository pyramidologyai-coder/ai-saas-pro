'use client';

import React, { useState, useEffect } from 'react';
import styles from './Settings.module.css';
import { supabase } from '@/lib/supabase';

const SettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    google_review_link: '',
    working_hours: '',
    custom_prompt: '',
    whatsapp_number_id: '',
    meta_token: '',
    instagram_id: ''
  });

  useEffect(() => {
    async function loadSettings() {
      // In a real app, this comes from auth context. Using the demo tenant for now.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/auth';
        return;
      }
      const { data, error } = await supabase.from('tenants').select('*').eq('user_id', session.user.id).single();
      
      if (data) {
        setTenantId(data.id);
        setFormData({
          name: data.name || '',
          google_review_link: data.google_review_link || '',
          working_hours: data.working_hours || '',
          custom_prompt: data.custom_prompt || '',
          whatsapp_number_id: data.whatsapp_number_id || '',
          meta_token: data.meta_token || '',
          instagram_id: data.instagram_id || ''
        });
      }
      setLoading(false);
    }
    loadSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          name: formData.name,
          google_review_link: formData.google_review_link,
          working_hours: formData.working_hours,
          custom_prompt: formData.custom_prompt,
          whatsapp_number_id: formData.whatsapp_number_id,
          meta_token: formData.meta_token,
          instagram_id: formData.instagram_id
        })
        .eq('id', tenantId);

      if (error) throw error;
      alert('تم حفظ الإعدادات بنجاح!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('حدث خطأ أثناء الحفظ.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.container}>جاري التحميل...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>إعدادات الذكاء الاصطناعي والعيادة</h1>
        <p>قم بتخصيص طريقة رد الذكاء الاصطناعي ومعلومات العيادة الخاصة بك.</p>
      </div>

      <form className={styles.formCard} onSubmit={handleSave}>
        
        <div className={styles.formGroup}>
          <label>اسم العيادة / المطعم</label>
          <input 
            type="text" 
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={styles.input} 
            placeholder="مثال: عيادة د. أحمد للأسنان"
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label>مواعيد العمل</label>
          <input 
            type="text" 
            name="working_hours"
            value={formData.working_hours}
            onChange={handleChange}
            className={styles.input} 
            placeholder="مثال: يومياً من 12 ظهراً لـ 10 مساءً ما عدا الجمعة"
          />
        </div>

        <div className={styles.formGroup}>
          <label>رابط تقييم جوجل (Google Review)</label>
          <input 
            type="url" 
            name="google_review_link"
            value={formData.google_review_link}
            onChange={handleChange}
            className={styles.input} 
            placeholder="https://g.page/review/..."
          />
        </div>

        <div className={styles.formGroup}>
          <label>تعليمات خاصة للذكاء الاصطناعي (Custom Prompt)</label>
          <textarea 
            name="custom_prompt"
            value={formData.custom_prompt}
            onChange={handleChange}
            className={`${styles.input} ${styles.textarea}`} 
            placeholder="أضف أي معلومات تريد من الذكاء الاصطناعي أن يعرفها. مثال: د. أحمد عنده خبرة 20 سنة، وتكلفة الكشف المستعجل 500 جنيه، والكشف العادي 300 جنيه."
          />
        </div>

        <div className={styles.formGroup} style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '2rem', marginTop: '1rem' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--accent-primary)' }}>ربط مواعيد جوجل (Google Calendar)</h3>
          <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            اربط نتيجتك عشان الذكاء الاصطناعي يقدر يضيف الحجوزات أوتوماتيك وتسمع في موبايلك.
          </p>
          <a 
            href={`/api/calendar/auth?tenantId=${tenantId}`}
            className={styles.saveBtn} 
            style={{ display: 'inline-block', backgroundColor: '#4285F4', color: 'white', textDecoration: 'none', textAlign: 'center', width: 'auto', padding: '0.8rem 2rem' }}
          >
            ربط حساب جوجل
          </a>
        </div>

        <div className={styles.formGroup} style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '2rem', marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--accent-primary)' }}>ربط السوشيال ميديا والذكاء الاصطناعي (Meta API)</h3>
          
          <label>رقم معرف واتساب (WhatsApp Phone ID)</label>
          <input 
            type="text" 
            name="whatsapp_number_id"
            value={formData.whatsapp_number_id}
            onChange={handleChange}
            className={styles.input} 
            placeholder="مثال: 1046139101921254"
          />
        </div>

        <div className={styles.formGroup}>
          <label>توكن ميتا (Meta Access Token)</label>
          <input 
            type="password" 
            name="meta_token"
            value={formData.meta_token}
            onChange={handleChange}
            className={styles.input} 
            placeholder="EAAX..."
          />
        </div>

        <div className={styles.formGroup}>
          <label>معرف انستجرام / ماسنجر (اختياري)</label>
          <input 
            type="text" 
            name="instagram_id"
            value={formData.instagram_id}
            onChange={handleChange}
            className={styles.input} 
            placeholder="مثال: 1234567890123"
          />
        </div>

        <button type="submit" className={styles.saveBtn} disabled={saving}>
          {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>

      </form>
    </div>
  );
};

export default SettingsPage;
