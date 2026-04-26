'use client';
import React, { useState, useEffect } from 'react';
import { User, Upload, EyeOff, Eye, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword1, setShowPassword1] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [showPassword3, setShowPassword3] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    countryCode: '+20',
    phone: '',
    currentPassword: '',
    newPassword: '',
    repeatPassword: ''
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setFormData(prev => ({
            ...prev,
            email: session.user.email || '',
            // We can fetch name and phone from profiles/tenants table in real life
            firstName: 'Ahmed',
            lastName: 'Hafez',
            phone: '1115351111'
          }));
        }
      } catch (error) {
        console.error('Error fetching user', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    // Simulate save
    setTimeout(() => {
      setSaving(false);
      alert('تم تحديث البيانات بنجاح!');
    }, 1000);
  };

  if (loading) {
    return <div style={{ padding: '2rem', color: 'var(--text-dim)' }}>جاري التحميل...</div>;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
      
      {/* Header Tabs Simulation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', marginBottom: '2rem', justifyContent: 'center', gap: '2rem' }}>
        <div style={{ padding: '1rem', color: 'var(--text-dim)', cursor: 'pointer' }}>الرئيسية (Dashboard)</div>
        <div style={{ padding: '1rem', color: 'var(--accent-primary)', borderBottom: '2px solid var(--accent-primary)', fontWeight: 'bold', cursor: 'pointer' }}>الملف الشخصي (Profile)</div>
        <div style={{ padding: '1rem', color: 'var(--text-dim)', cursor: 'pointer' }}>المحفظة (My Wallet)</div>
      </div>

      <div style={{ 
        background: 'var(--card-bg)', 
        borderRadius: '24px', 
        padding: '2.5rem', 
        border: '1px solid var(--glass-border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.05)'
      }}>
        <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 700 }}>الملف الشخصي (Profile)</h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: '2rem', fontSize: '0.9rem' }}>إدارة المعلومات الشخصية الخاصة بك</p>

        {/* Avatar Upload */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '3rem' }}>
          <div style={{ 
            width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-color)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--glass-border)'
          }}>
            <User size={40} color="var(--text-dim)" />
          </div>
          <div>
            <button style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)',
              padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, marginBottom: '0.5rem'
            }}>
              <Upload size={16} /> رفع صورة
            </button>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Supported files: JPG, JPEG, PNG. Max 5MB</span>
          </div>
        </div>

        {/* Account Information */}
        <div style={{ marginBottom: '2.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>معلومات الحساب</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input 
              type="text" name="firstName" value={formData.firstName} onChange={handleChange}
              placeholder="الاسم الأول" style={inputStyle}
            />
            <input 
              type="text" name="lastName" value={formData.lastName} onChange={handleChange}
              placeholder="الاسم الأخير" style={inputStyle}
            />
            <input 
              type="email" name="email" value={formData.email} disabled
              placeholder="البريد الإلكتروني" style={{ ...inputStyle, background: 'rgba(255,255,255,0.02)', color: 'var(--text-dim)', cursor: 'not-allowed' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select name="countryCode" value={formData.countryCode} onChange={handleChange} style={{ ...inputStyle, width: '100px', textAlign: 'left', direction: 'ltr' }}>
                <option value="+20">(+20) Egypt</option>
                <option value="+966">(+966) KSA</option>
                <option value="+971">(+971) UAE</option>
              </select>
              <input 
                type="text" name="phone" value={formData.phone} onChange={handleChange}
                placeholder="رقم الهاتف" style={{ ...inputStyle, flex: 1, direction: 'ltr', textAlign: 'left' }}
              />
            </div>
          </div>
        </div>

        {/* Password */}
        <div style={{ marginBottom: '3rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>كلمة المرور</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword1 ? 'text' : 'password'} name="currentPassword" value={formData.currentPassword} onChange={handleChange}
                placeholder="كلمة المرور الحالية" style={inputStyle}
              />
              <button onClick={() => setShowPassword1(!showPassword1)} style={iconButtonStyle}>
                {showPassword1 ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword2 ? 'text' : 'password'} name="newPassword" value={formData.newPassword} onChange={handleChange}
                placeholder="كلمة المرور الجديدة" style={inputStyle}
              />
              <button onClick={() => setShowPassword2(!showPassword2)} style={iconButtonStyle}>
                {showPassword2 ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword3 ? 'text' : 'password'} name="repeatPassword" value={formData.repeatPassword} onChange={handleChange}
                placeholder="تأكيد كلمة المرور الجديدة" style={inputStyle}
              />
              <button onClick={() => setShowPassword3(!showPassword3)} style={iconButtonStyle}>
                {showPassword3 ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button 
          onClick={handleSave} 
          disabled={saving}
          style={{
            width: '100%', background: 'var(--accent-primary)', color: 'white', border: 'none',
            padding: '1rem', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', transition: '0.3s'
          }}
        >
          <Save size={20} /> {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>

      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.8rem 1rem',
  borderRadius: '8px',
  border: '1px solid var(--glass-border)',
  background: 'var(--bg-color)',
  color: 'var(--text-main)',
  fontSize: '0.95rem',
  outline: 'none',
  transition: 'border-color 0.3s'
};

const iconButtonStyle: React.CSSProperties = {
  position: 'absolute',
  left: '1rem',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  color: 'var(--text-dim)',
  cursor: 'pointer'
};
