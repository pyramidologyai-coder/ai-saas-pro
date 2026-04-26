'use client';

import React, { useState, useEffect } from 'react';
import styles from './Team.module.css';
import { supabase } from '@/lib/supabase';

interface TeamMember {
  id: string;
  name: string;
  role_or_specialty: string;
  working_hours: string;
  google_calendar_refresh_token: string | null;
}

const TeamPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    role_or_specialty: '',
    working_hours: ''
  });

  const loadTeam = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = '/auth';
      return;
    }
    
    // Get Tenant ID
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('id')
      .eq('user_id', session.user.id)
      .single();
      
    if (tenantData) {
      setTenantId(tenantData.id);
      
      // Get Team Members
      const { data: teamData } = await supabase
        .from('team_members')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .order('created_at', { ascending: true });
        
      if (teamData) {
        setMembers(teamData);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTeam();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .insert({
          tenant_id: tenantId,
          name: formData.name,
          role_or_specialty: formData.role_or_specialty,
          working_hours: formData.working_hours
        });

      if (error) throw error;
      
      setFormData({ name: '', role_or_specialty: '', working_hours: '' });
      await loadTeam(); // Reload list
      alert('تم إضافة العضو بنجاح!');
    } catch (error) {
      console.error('Error adding team member:', error);
      alert('حدث خطأ أثناء الإضافة.');
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
        <h1>إدارة الفريق والأطباء</h1>
        <p>أضف الأطباء أو مديري الفروع واربط نتيجة (Calendar) كل شخص فيهم بالذكاء الاصطناعي.</p>
      </div>

      <form className={styles.addCard} onSubmit={handleAddMember}>
        <h3>إضافة عضو جديد</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className={styles.formGroup}>
            <label>الاسم</label>
            <input 
              type="text" 
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={styles.input} 
              placeholder="مثال: د. أحمد محمد"
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label>التخصص / الدور</label>
            <input 
              type="text" 
              name="role_or_specialty"
              value={formData.role_or_specialty}
              onChange={handleChange}
              className={styles.input} 
              placeholder="مثال: طبيب أسنان"
            />
          </div>
        </div>
        <div className={styles.formGroup}>
          <label>مواعيد العمل (مهم للذكاء الاصطناعي)</label>
          <input 
            type="text" 
            name="working_hours"
            value={formData.working_hours}
            onChange={handleChange}
            className={styles.input} 
            placeholder="مثال: من 2 ظهراً لـ 10 مساءً"
          />
        </div>
        <button type="submit" className={styles.saveBtn} disabled={saving}>
          {saving ? 'جاري الإضافة...' : 'إضافة للفريق'}
        </button>
      </form>

      <h3 style={{ marginBottom: '1.5rem', marginTop: '2rem' }}>أعضاء الفريق الحاليين</h3>
      <div className={styles.teamList}>
        {members.map(member => (
          <div key={member.id} className={styles.memberCard}>
            <div className={styles.memberName}>{member.name}</div>
            <div className={styles.memberRole}>{member.role_or_specialty || 'بدون تخصص محدد'}</div>
            <div className={styles.memberInfo}>
              <strong>المواعيد:</strong> {member.working_hours || 'غير محدد'}
            </div>
            
            {member.google_calendar_refresh_token ? (
              <div className={styles.connectedStatus}>
                ✓ تم ربط النتيجة بنجاح
              </div>
            ) : (
              <a 
                href={`/api/calendar/auth?tenantId=${tenantId}&memberId=${member.id}`} 
                className={styles.connectBtn}
              >
                ربط نتيجة جوجل (Calendar)
              </a>
            )}
          </div>
        ))}

        {members.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
            لم يتم إضافة أي أعضاء للفريق حتى الآن.
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamPage;
