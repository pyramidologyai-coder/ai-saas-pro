'use client';

import React, { useState, useEffect } from 'react';
import styles from './Users.module.css';
import { createClient } from '@/utils/supabase/client';
import { UserPlus, Shield, UserCog, Trash2, Pencil, X } from 'lucide-react';
import { getDictionary } from '@/lib/dictionary';
import { getActiveTenant } from '@/lib/tenant';
import { getUserPermissions } from '@/lib/permissions';

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
  const supabase = createClient();
  const [users, setUsers] = useState<Profile[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [dict, setDict] = useState(() => getDictionary('clinic'));

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Profile | null>(null);
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    role: 'staff',
    branch_access: ['all'] as string[],
    permissions: {
      view_revenue: false,
      manage_settings: false,
      view_all_bookings: false
    }
  });

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
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

      const perms = await getUserPermissions(supabase, session.user);
      if (!perms || !perms.canManageUsers) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }
      setIsAuthorized(true);

      const tenantData = await getActiveTenant(session.user);

      if (tenantData) {
        setTenantId(tenantData.id);
        setDict(getDictionary(tenantData.type));
        
        // Fetch branches for this tenant to populate the dropdown
        const { data: branchData } = await supabase
          .from('branches')
          .select('id, name')
          .eq('tenant_id', tenantData.id);
          
        if (branchData) {
          // Store branches in state (need to add branches state above)
          setBranches(branchData);
        }

        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .eq('tenant_id', tenantData.id);
          
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

  const openEditModal = (user: Profile) => {
    setSelectedStaff(user);
    setEditFormData({
      fullName: user.full_name,
      role: user.role,
      branch_access: user.branch_access || ['all'],
      permissions: {
        view_revenue: user.permissions?.view_revenue || false,
        manage_settings: user.permissions?.manage_settings || false,
        view_all_bookings: user.permissions?.view_all_bookings || false
      }
    });
    setIsEditModalOpen(true);
  };

  const handleEditStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !tenantId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        alert('جلسة العمل منتهية، يرجى تسجيل الدخول مجدداً.');
        return;
      }

      const response = await fetch('/api/staff/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          staff_id: selectedStaff.id,
          tenant_id: tenantId,
          token,
          full_name: editFormData.fullName,
          role: editFormData.role,
          branch_access: editFormData.branch_access,
          permissions: editFormData.permissions
        })
      });

      const resData = await response.json();
      if (!response.ok || resData.error) {
        alert(resData.error || 'حدث خطأ أثناء تعديل صلاحيات الموظف.');
        return;
      }

      setUsers(users.map(u => u.id === selectedStaff.id ? {
        ...u,
        full_name: editFormData.fullName,
        role: editFormData.role as any,
        branch_access: editFormData.branch_access,
        permissions: editFormData.permissions
      } : u));

      setIsEditModalOpen(false);
      setSelectedStaff(null);
      alert('تم تحديث صلاحيات الموظف بنجاح ✅');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ غير متوقع: ' + err.message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!tenantId) return;
    if (!confirm('هل أنت متأكد من حذف حساب هذا الموظف نهائياً؟')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        alert('جلسة العمل منتهية، يرجى تسجيل الدخول مجدداً.');
        return;
      }

      const response = await fetch('/api/staff/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          staff_id: userId,
          tenant_id: tenantId,
          token
        })
      });

      const resData = await response.json();
      if (!response.ok || resData.error) {
        alert(resData.error || 'حدث خطأ أثناء حذف الموظف.');
        return;
      }

      setUsers(users.filter(u => u.id !== userId));
      alert('تم حذف الموظف بنجاح ✅');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ غير متوقع: ' + err.message);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
      alert('حدث خطأ: معرف النشاط التجاري غير متوفر.');
      return;
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        alert('جلسة العمل منتهية، يرجى تسجيل الدخول مجدداً.');
        return;
      }
      
      const response = await fetch('/api/staff/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          full_name: formData.fullName,
          email: formData.email,
          role: formData.role,
          branch_access: formData.branch_access,
          permissions: formData.permissions,
          tenant_id: tenantId,
          token
        })
      });
      
      const resData = await response.json();
      
      if (!response.ok || resData.error) {
        alert(resData.error || 'حدث خطأ أثناء إنشاء حساب الموظف.');
        return;
      }
      
      const newProfile: Profile = {
        id: resData.user.id,
        full_name: formData.fullName,
        role: formData.role as any,
        email: formData.email,
        branch_access: formData.branch_access,
        permissions: formData.permissions,
        created_at: new Date().toISOString()
      };
      
      setUsers([...users, newProfile]);
      setFormData({ 
        fullName: '', 
        email: '', 
        role: 'staff', 
        branch_access: ['all'],
        permissions: { 
          view_revenue: false, 
          manage_settings: false, 
          view_all_bookings: false 
        } 
      });
      
      alert(`تم إنشاء حساب الموظف بنجاح ✅\n\nالبريد الإلكتروني: ${resData.user.email}\nكلمة المرور المؤقتة: ${resData.user.temp_password}\n\nيرجى نسخ كلمة المرور وتسليمها للموظف ليتمكن من تسجيل الدخول.`);
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ غير متوقع: ' + err.message);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return <span className={`${styles.roleBadge} ${styles.roleAdmin}`}>مدير نظام</span>;
      case 'doctor': return <span className={`${styles.roleBadge} ${styles.roleDoctor}`}>{dict.provider}</span>;
      case 'manager': return <span className={`${styles.roleBadge}`} style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: '#eab308', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid rgba(234, 179, 8, 0.2)' }}>مدير تشغيلي</span>;
      case 'secretary': return <span className={`${styles.roleBadge}`} style={{ backgroundColor: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid rgba(236, 72, 153, 0.2)' }}>سكرتير</span>;
      default: return <span className={`${styles.roleBadge} ${styles.roleStaff}`}>موظف عام</span>;
    }
  };

  if (loading) return <div className={styles.container}>جاري التحميل...</div>;

  if (isAuthorized === false) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '5rem 2rem' }}>
        <h1 style={{ color: '#ef4444', fontSize: '2rem', marginBottom: '1rem', fontWeight: 'bold' }}>غير مصرح لك بالدخول</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '1.1rem' }}>عذراً، هذه الصفحة مخصصة لمدير النظام فقط.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>إدارة صلاحيات المستخدمين (RBAC)</h1>
        <p>أضف أعضاء فريق العمل لحساب نشاطك وحدد صلاحية كل شخص بدقة.</p>
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
              <label>الصلاحية والدور (Role)</label>
              <select 
                className={styles.input}
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value})}
              >
                <option value="staff">موظف (Staff) - صلاحيات عامة</option>
                <option value="secretary">سكرتير (Secretary) - استقبال وإدارة الحجوزات</option>
                <option value="manager">مدير (Manager) - إدارة تشغيلية</option>
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
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button 
                        style={{ 
                          width: 'auto', 
                          padding: '0.4rem 0.8rem', 
                          margin: 0, 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.3rem', 
                          background: 'rgba(99, 102, 241, 0.1)', 
                          border: '1px solid rgba(99, 102, 241, 0.2)', 
                          color: '#a5b4fc', 
                          fontSize: '0.85rem',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }} 
                        title="تعديل الموظف"
                        onClick={() => openEditModal(user)}
                      >
                        <Pencil size={16} /> تعديل
                      </button>
                      <button 
                        className={styles.deleteBtn} 
                        title="حذف حساب المستخدم"
                        onClick={() => handleDeleteUser(user.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
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

      {/* Edit Staff Modal */}
      {isEditModalOpen && selectedStaff && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className={styles.card} style={{
            maxWidth: '650px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
            animation: 'fadeIn 0.2s ease',
            margin: 0,
            position: 'relative'
          }}>
            <button 
              onClick={() => {
                setIsEditModalOpen(false);
                setSelectedStaff(null);
              }}
              style={{
                position: 'absolute',
                top: '1.5rem',
                left: '1.5rem',
                background: 'rgba(255,255,255,0.05)',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: '0.4rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="إغلاق"
            >
              <X size={18} />
            </button>

            <h2 className={styles.cardTitle} style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Pencil size={24} color="#6366f1" /> تعديل صلاحيات الموظف: {selectedStaff.full_name}
            </h2>

            <form onSubmit={handleEditStaffSubmit}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                  <label>الاسم بالكامل</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    value={editFormData.fullName}
                    onChange={e => setEditFormData({...editFormData, fullName: e.target.value})}
                    required
                  />
                </div>
                
                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                  <label>الصلاحية والدور (Role)</label>
                  <select 
                    className={styles.input}
                    value={editFormData.role}
                    onChange={e => setEditFormData({...editFormData, role: e.target.value as any})}
                  >
                    <option value="staff">موظف (Staff) - صلاحيات عامة</option>
                    <option value="secretary">سكرتير (Secretary) - استقبال وإدارة الحجوزات</option>
                    <option value="manager">مدير (Manager) - إدارة تشغيلية</option>
                    <option value="doctor">{dict.provider} (Provider) - يرى مساحته الخاصة فقط</option>
                    <option value="admin">مدير نظام (Admin) - تحكم كامل</option>
                  </select>
                </div>
                
                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                  <label>نطاق الفروع المسموحة</label>
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
                        checked={editFormData.branch_access.includes('all') || editFormData.role === 'admin'}
                        disabled={editFormData.role === 'admin'}
                        onChange={e => {
                          if (e.target.checked) setEditFormData({...editFormData, branch_access: ['all']});
                          else setEditFormData({...editFormData, branch_access: []});
                        }}
                      />
                      كل الفروع (صلاحية كاملة)
                    </label>
                    
                    {branches.map(b => (
                      <label key={b.id} className={styles.checkboxLabel} style={{ opacity: editFormData.branch_access.includes('all') || editFormData.role === 'admin' ? 0.5 : 1 }}>
                        <input 
                          type="checkbox" 
                          checked={(!editFormData.branch_access.includes('all') && editFormData.branch_access.includes(b.id)) || editFormData.role === 'admin'}
                          disabled={editFormData.branch_access.includes('all') || editFormData.role === 'admin'}
                          onChange={e => {
                            const newAccess = e.target.checked 
                              ? [...editFormData.branch_access.filter(id => id !== 'all'), b.id]
                              : editFormData.branch_access.filter(id => id !== b.id);
                            setEditFormData({...editFormData, branch_access: newAccess});
                          }}
                        />
                        {b.name}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Granular Permissions */}
              <div className={styles.permissionsContainer} style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-bright)', marginBottom: '1rem' }}>صلاحيات إضافية (مخصصة)</h3>
                <div className={styles.checkboxGroup}>
                  <label className={styles.checkboxLabel}>
                    <input 
                      type="checkbox" 
                      checked={editFormData.permissions.view_revenue || editFormData.role === 'admin'}
                      disabled={editFormData.role === 'admin'}
                      onChange={e => setEditFormData({
                        ...editFormData, 
                        permissions: {...editFormData.permissions, view_revenue: e.target.checked}
                      })}
                    />
                    السماح برؤية الأرباح والتقارير المالية
                  </label>
                  
                  <label className={styles.checkboxLabel}>
                    <input 
                      type="checkbox" 
                      checked={editFormData.permissions.view_all_bookings || editFormData.role === 'admin'}
                      disabled={editFormData.role === 'admin'}
                      onChange={e => setEditFormData({
                        ...editFormData, 
                        permissions: {...editFormData.permissions, view_all_bookings: e.target.checked}
                      })}
                    />
                    السماح برؤية كل {dict.bookings} (وليس الخاصة به فقط)
                  </label>
                  
                  <label className={styles.checkboxLabel}>
                    <input 
                      type="checkbox" 
                      checked={editFormData.permissions.manage_settings || editFormData.role === 'admin'}
                      disabled={editFormData.role === 'admin'}
                      onChange={e => setEditFormData({
                        ...editFormData, 
                        permissions: {...editFormData.permissions, manage_settings: e.target.checked}
                      })}
                    />
                    السماح بتعديل إعدادات الذكاء الاصطناعي والرسائل
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedStaff(null);
                  }}
                  className={styles.deleteBtn}
                  style={{ width: 'auto', padding: '0.8rem 2rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-dim)', border: 'none', borderRadius: '12px' }}
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  className={styles.submitBtn}
                  style={{ width: 'auto', padding: '0.8rem 2.5rem', margin: 0 }}
                >
                  حفظ التغييرات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
