'use client';

import React, { useState, useEffect } from 'react';
import styles from './Users.module.css';
import { supabase } from '@/lib/supabase';
import { UserPlus, Shield, UserCog, Trash2 } from 'lucide-react';
import { getDictionary } from '@/lib/dictionary';

interface Profile {
  id: string;
  full_name: string;
  role: 'admin' | 'staff' | 'doctor';
  email?: string;
  branch_access: string[]; // ['all'] or array of branch_ids
  permissions: {
    view_revenue: boolean;
    manage_settings: boolean;
    view_all_bookings: boolean;
  };
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [dict, setDict] = useState(() => getDictionary('clinic'));

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'staff',
    branch_access: ['all'],
    permissions: {
      view_revenue: false,
      manage_settings: false,
      view_all_bookings: false
    }
  });

  const loadUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, type')
        .eq('user_id', session.user.id)
        .single();

      if (tenant) {
        setTenantId(tenant.id);
        setDict(getDictionary(tenant.type));
        
        // Fetch branches for this tenant to populate the dropdown
        const { data: branchData } = await supabase
          .from('branches')
          .select('id, name')
          .eq('tenant_id', tenant.id);
          
        if (branchData) {
          // Store branches in state (need to add branches state above)
          setBranches(branchData);
        }

        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .eq('tenant_id', tenant.id);
          
        if (profiles) setUsers(profiles as Profile[]);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    
    try {
      const { data, error } = await supabase.from('profiles').insert({
        tenant_id: tenantId,
        full_name: formData.fullName,
        email: formData.email,
        role: formData.role,
        branch_access: formData.branch_access,
        permissions: formData.permissions
      }).select().single();

      if (error) {
        console.error('Error inserting profile:', error);
        alert('حدث خطأ أثناء حفظ المستخدم في قاعدة البيانات.');
        return;
      }

      setUsers([...users, data as Profile]);
      setFormData({ 
        fullName: '', email: '', password: '', role: 'staff', branch_access: ['all'],
        permissions: { view_revenue: false, manage_settings: false, view_all_bookings: false } 
      });
      
      alert('تم إضافة ملف المستخدم بنجاح! في بيئة الإنتاج الفعلية، سيتم إرسال بريد إلكتروني للمستخدم بكلمة المرور المؤقتة لتسجيل الدخول.');
    } catch (err) {
      console.error(err);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return <span className={`${styles.roleBadge} ${styles.roleAdmin}`}>مدير نظام</span>;
      case 'doctor': return <span className={`${styles.roleBadge} ${styles.roleDoctor}`}>{dict.provider}</span>;
      default: return <span className={`${styles.roleBadge} ${styles.roleStaff}`}>موظف عام</span>;
    }
  };

  if (loading) return <div className={styles.container}>جاري التحميل...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>إدارة صلاحيات المستخدمين (RBAC)</h1>
        <p>أضف موظفين أو أطباء لحساب العيادة وحدد صلاحية كل شخص بدقة.</p>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}><UserPlus size={24} color="#6366f1" /> إضافة مستخدم جديد للوحة التحكم</h2>
        <form onSubmit={handleAddUser}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>الاسم بالكامل</label>
              <input 
                type="text" 
                className={styles.input} 
                placeholder="مثال: منى سعيد"
                value={formData.fullName}
                onChange={e => setFormData({...formData, fullName: e.target.value})}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>البريد الإلكتروني (لتسجيل الدخول)</label>
              <input 
                type="email" 
                className={styles.input} 
                placeholder="m.saeed@clinic.com"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>كلمة المرور المؤقتة</label>
              <input 
                type="text" 
                className={styles.input} 
                placeholder="******"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>الصلاحية والدور (Role)</label>
              <select 
                className={styles.input}
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value})}
              >
                <option value="staff">موظف (Staff) - صلاحيات محدودة</option>
                <option value="doctor">{dict.provider} (Provider) - يرى مساحته الخاصة فقط</option>
                <option value="admin">مدير نظام (Admin) - تحكم كامل</option>
              </select>
            </div>
            
            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <label>نطاق الفروع المسموحة (يمكنك اختيار أكثر من فرع)</label>
              <div className={styles.checkboxGroup} style={{ 
                flexDirection: 'row', 
                flexWrap: 'wrap', 
                gap: '1.5rem', 
                marginTop: '0.5rem', 
                background: 'var(--bg-input)', 
                padding: '1rem 1.5rem', 
                borderRadius: '10px', 
                border: '1px solid var(--border-color)' 
              }}>
                <label className={styles.checkboxLabel}>
                  <input 
                    type="checkbox" 
                    checked={formData.branch_access.includes('all') || formData.role === 'admin'}
                    disabled={formData.role === 'admin'}
                    onChange={e => {
                      if (e.target.checked) setFormData({...formData, branch_access: ['all']});
                      else setFormData({...formData, branch_access: []});
                    }}
                  />
                  كل الفروع (صلاحية كاملة)
                </label>
                
                {branches.map(b => (
                  <label key={b.id} className={styles.checkboxLabel} style={{ opacity: formData.branch_access.includes('all') || formData.role === 'admin' ? 0.5 : 1 }}>
                    <input 
                      type="checkbox" 
                      checked={(!formData.branch_access.includes('all') && formData.branch_access.includes(b.id)) || formData.role === 'admin'}
                      disabled={formData.branch_access.includes('all') || formData.role === 'admin'}
                      onChange={e => {
                        const newAccess = e.target.checked 
                          ? [...formData.branch_access.filter(id => id !== 'all'), b.id]
                          : formData.branch_access.filter(id => id !== b.id);
                        setFormData({...formData, branch_access: newAccess});
                      }}
                    />
                    {b.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
          
          {/* Granular Permissions Section */}
          <div className={styles.permissionsContainer}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-bright)', marginBottom: '1rem', marginTop: '0.5rem' }}>صلاحيات إضافية (مخصصة)</h3>
            <div className={styles.checkboxGroup}>
              <label className={styles.checkboxLabel}>
                <input 
                  type="checkbox" 
                  checked={formData.permissions.view_revenue || formData.role === 'admin'}
                  disabled={formData.role === 'admin'}
                  onChange={e => setFormData({...formData, permissions: {...formData.permissions, view_revenue: e.target.checked}})}
                />
                السماح برؤية الأرباح والتقارير المالية
              </label>
              
              <label className={styles.checkboxLabel}>
                <input 
                  type="checkbox" 
                  checked={formData.permissions.view_all_bookings || formData.role === 'admin'}
                  disabled={formData.role === 'admin'}
                  onChange={e => setFormData({...formData, permissions: {...formData.permissions, view_all_bookings: e.target.checked}})}
                />
                السماح برؤية كل {dict.bookings} (وليس الخاصة به فقط)
              </label>
              
              <label className={styles.checkboxLabel}>
                <input 
                  type="checkbox" 
                  checked={formData.permissions.manage_settings || formData.role === 'admin'}
                  disabled={formData.role === 'admin'}
                  onChange={e => setFormData({...formData, permissions: {...formData.permissions, manage_settings: e.target.checked}})}
                />
                السماح بتعديل إعدادات الذكاء الاصطناعي والرسائل
              </label>
            </div>
          </div>

          <button type="submit" className={styles.submitBtn}>
            <Shield size={20} /> إنشاء الحساب ومنح الصلاحية
          </button>
        </form>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}><UserCog size={24} color="#a5b4fc" /> قائمة المستخدمين الحاليين</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.usersTable}>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الصلاحية</th>
                <th>تاريخ الانضمام</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td style={{ fontWeight: 600 }}>{user.full_name || 'بدون اسم'}</td>
                  <td>{getRoleBadge(user.role)}</td>
                  <td style={{ color: 'var(--text-dim)' }}>{new Date(user.created_at).toLocaleDateString('ar-EG')}</td>
                  <td>
                    <button className={styles.deleteBtn} title="حذف حساب المستخدم">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
                    لا يوجد مستخدمين آخرين حالياً. المدير فقط هو من يمكنه الدخول.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
