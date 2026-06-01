'use client';

import React, { useState, useEffect } from 'react';
import styles from './Team.module.css';
import { createClient } from '@/utils/supabase/client';
import { Copy, Check } from 'lucide-react';
import { getDictionary } from '@/lib/dictionary';
import { getActiveTenant } from '@/lib/tenant';

interface TeamMember {
  id: string;
  name: string;
  role_or_specialty: string;
  working_hours: string;
  google_calendar_refresh_token: string | null;
  branch_ids?: string[] | null;
  provided_services?: string[] | null;
}

const TeamPage = () => {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dict, setDict] = useState(() => getDictionary('clinic'));
  const [allServices, setAllServices] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    role_or_specialty: '',
    working_hours: '',
    branch_ids: [] as string[],
    provided_services: [] as string[],
    is_all_branches: false,
    is_all_services: false
  });

  const loadTeam = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 1. Get Tenant ID
      const tenantData = await getActiveTenant(session.user);

      if (!tenantData) return;

      if (tenantData) {
        setTenantId(tenantData.id);
        setDict(getDictionary(tenantData.type));
        
        // 2. Fetch Branches for this tenant
        const { data: branchData } = await supabase
          .from('branches')
          .select('id, name')
          .eq('tenant_id', tenantData.id);
        if (branchData) setBranches(branchData);

        const { data: servicesData } = await supabase
          .from('items')
          .select('id, name')
          .eq('tenant_id', tenantData.id);
        if (servicesData) setAllServices(servicesData);

        // 3. Fetch Team Members
        const { data: teamData } = await supabase
          .from('team_members')
          .select(`*`)
          .eq('tenant_id', tenantData.id)
          .order('created_at', { ascending: true });
          
        if (teamData) {
          setMembers(teamData);
        }
      }
    } catch (error) {
      console.error('Error loading team:', error);
    } finally {
      setLoading(false);
    }
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
    try {
      setSaving(true);
      
      if (!formData.is_all_branches && formData.branch_ids.length === 0 && branches.length > 0) {
        alert('برجاء اختيار فرع واحد على الأقل، أو تفعيل خيار "يعمل في جميع الفروع"');
        setSaving(false);
        return;
      }

      if (!formData.is_all_services && formData.provided_services.length === 0 && allServices.length > 0) {
        alert('برجاء اختيار خدمة واحدة على الأقل، أو تفعيل خيار "يقدم جميع الخدمات"');
        setSaving(false);
        return;
      }

      const { data, error } = await supabase
        .from('team_members')
        .insert({
          tenant_id: tenantId,
          name: formData.name,
          role_or_specialty: formData.role_or_specialty,
          working_hours: formData.working_hours,
          branch_ids: formData.is_all_branches ? null : (formData.branch_ids.length > 0 ? formData.branch_ids : null),
          provided_services: formData.is_all_services ? null : (formData.provided_services.length > 0 ? formData.provided_services : null)
        });

      if (error) throw error;
      
      setFormData({ name: '', role_or_specialty: '', working_hours: '', branch_ids: [], provided_services: [], is_all_branches: false, is_all_services: false });
      await loadTeam(); // Reload list
      alert('تم إضافة العضو بنجاح!');
    } catch (error) {
      console.error('Error adding team member:', error);
      alert('حدث خطأ أثناء الإضافة.');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (memberId: string) => {
    const link = `${window.location.origin}/api/calendar/auth?tenantId=${tenantId}&memberId=${memberId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(memberId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return <div className={styles.container}>جاري التحميل...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>إدارة {dict.team}</h1>
        <p>أضف أعضاء الفريق أو مسؤولي الفروع واربط نتيجة (Calendar) كل شخص فيهم بالذكاء الاصطناعي.</p>
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
              placeholder={dict.provider === 'طبيب' ? "مثال: د. أحمد محمد" : "مثال: أحمد محمد"}
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
              placeholder={dict.provider === 'طبيب' ? "مثال: طبيب أسنان" : `مثال: ${dict.provider}`}
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
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
        </div>
        <div style={{ marginTop: '1.5rem', background: 'var(--bg-main)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <label style={{ display: 'block', marginBottom: '1rem', fontWeight: 600 }}>
            الفروع المربوطة
          </label>
          
          {branches.length > 0 && (
            <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, color: 'var(--accent-primary)' }}>
                <input 
                  type="checkbox" 
                  checked={formData.is_all_branches}
                  onChange={(e) => setFormData({...formData, is_all_branches: e.target.checked, branch_ids: []})}
                />
                يعمل في جميع الفروع (متاح لكل الفروع الحالية والمستقبلية)
              </label>
            </div>
          )}

          {branches.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>لا توجد فروع مسجلة.</div>
          ) : (
            !formData.is_all_branches && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                {branches.map(b => (
                  <label key={b.id} style={{ background: 'var(--bg-input)', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input 
                      type="checkbox" 
                      checked={formData.branch_ids.includes(b.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({...formData, branch_ids: [...formData.branch_ids, b.id]});
                        } else {
                          setFormData({...formData, branch_ids: formData.branch_ids.filter(id => id !== b.id)});
                        }
                      }}
                    />
                    {b.name}
                  </label>
                ))}
              </div>
            )
          )}
        </div>
        
        <div style={{ marginTop: '1.5rem', background: 'var(--bg-main)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <label style={{ display: 'block', marginBottom: '1rem', fontWeight: 600 }}>
            الخدمات المربوطة ({dict.services})
          </label>
          
          {allServices.length > 0 && (
            <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, color: 'var(--accent-primary)' }}>
                <input 
                  type="checkbox" 
                  checked={formData.is_all_services}
                  onChange={(e) => setFormData({...formData, is_all_services: e.target.checked, provided_services: []})}
                />
                يقدم جميع {dict.services} (متاح لكل الخدمات الحالية والمستقبلية)
              </label>
            </div>
          )}

          {allServices.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>لا توجد خدمات مضافة. يرجى إضافة الخدمات أولاً من شاشة {dict.services}.</div>
          ) : (
            !formData.is_all_services && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                {allServices.map(service => (
                  <label key={service.id} style={{ background: 'var(--bg-input)', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input 
                      type="checkbox" 
                      checked={formData.provided_services.includes(service.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({...formData, provided_services: [...formData.provided_services, service.id]});
                        } else {
                          setFormData({...formData, provided_services: formData.provided_services.filter(id => id !== service.id)});
                        }
                      }}
                    />
                    {service.name}
                  </label>
                ))}
              </div>
            )
          )}
        </div>

        <button type="submit" className={styles.saveBtn} disabled={saving} style={{ marginTop: '1.5rem' }}>
          {saving ? 'جاري الإضافة...' : 'إضافة للفريق'}
        </button>
      </form>

      <h3 style={{ marginBottom: '1.5rem', marginTop: '2rem' }}>أعضاء الفريق الحاليين</h3>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>الاسم ({dict.provider})</th>
              <th>التخصص / الدور</th>
              <th>مواعيد العمل</th>
              <th>الفروع</th>
              <th>الخدمات المربوطة</th>
              <th style={{ textAlign: 'center' }}>ربط النتيجة (Calendar)</th>
              <th style={{ textAlign: 'center' }}>مشاركة</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                  لم يتم إضافة أي أعضاء للفريق حتى الآن.
                </td>
              </tr>
            ) : (
              members.map(member => (
                <tr key={member.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{member.name}</td>
                  <td style={{ color: 'var(--text-dim)' }}>{member.role_or_specialty || 'بدون تخصص'}</td>
                  <td style={{ color: 'var(--text-main)' }}>{member.working_hours || 'غير محدد'}</td>
                  <td>
                    {member.branch_ids && member.branch_ids.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                        {member.branch_ids.map(bId => {
                          const branch = branches.find(b => b.id === bId);
                          return branch ? (
                            <span key={branch.id} style={{ fontSize: '0.75rem', background: 'var(--accent-primary)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                              {branch.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>كل الفروع</span>
                    )}
                  </td>
                  <td>
                    {member.provided_services && member.provided_services.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                        {member.provided_services.map(srvId => {
                          const srv = allServices.find(s => s.id === srvId);
                          return srv ? (
                            <span key={srv.id} style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.1)', color: '#a5b4fc', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                              {srv.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>كل الخدمات</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {member.google_calendar_refresh_token ? (
                      <div className={styles.connectedStatus}>✓ تم الربط</div>
                    ) : (
                      <a href={`/api/calendar/auth?tenantId=${tenantId}&memberId=${member.id}`} className={styles.connectBtn}>
                        ربط النتيجة
                      </a>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {!member.google_calendar_refresh_token && (
                      <button 
                        onClick={() => copyToClipboard(member.id)}
                        title="نسخ الرابط للمشاركة"
                        style={{
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-main)',
                          padding: '0.5rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s'
                        }}
                      >
                        {copiedId === member.id ? <Check size={18} color="#10b981" /> : <Copy size={18} />}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeamPage;
