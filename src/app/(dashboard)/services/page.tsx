'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getDictionary } from '@/lib/dictionary';
import { getActiveTenant } from '@/lib/tenant';
import { Plus, Trash2, Edit2, Loader2, Upload, FileSpreadsheet, Stethoscope, Utensils } from 'lucide-react';

const ServicesPage = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<any>(null);
  const [dict, setDict] = useState(() => getDictionary('clinic'));
  const [isAdding, setIsAdding] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: '', duration: '30', image_url: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/auth';
        return;
      }
      const tenantData = await getActiveTenant(session.user);
      if (!tenantData) return;
      setTenant(tenantData);
      setDict(getDictionary(tenantData.type));

      const { data: itemsData } = await supabase
        .from('items')
        .select('*')
        .eq('tenant_id', tenantData.id);
      
      setItems(itemsData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.price) return;
    if (!tenant?.id) { alert('لم يتم تحميل بيانات النشاط — يرجى تحديث الصفحة'); return; }
    try {
      const { data, error } = await supabase.from('items').insert({
        tenant_id: tenant.id,
        name: newItem.name,
        price: parseFloat(newItem.price),
        duration_minutes: parseInt(newItem.duration),
      }).select().single();

      if (error) throw error;
      if (data) {
        setItems([...items, data]);
        setIsAdding(false);
        setNewItem({ name: '', price: '', duration: '30', image_url: '' });
      }
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء الحفظ: ' + (err.message || 'خطأ غير معروف'));
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await supabase.from('items').delete().eq('id', id);
      setItems(items.filter(i => i.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}><Loader2 className="animate-spin" /></div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem' }}>
            {dict.services}
          </h1>
          <p style={{ color: 'var(--text-dim)' }}>أضف أو عدل {dict.services} التي سيقوم الـ AI بعرضها للعملاء.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={() => setIsBulkUploading(true)}
            style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)', padding: '0.8rem 1.5rem', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.2)', cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center', fontWeight: '600' }}
          >
            <FileSpreadsheet size={20} /> رفع ملف إكسيل (Bulk)
          </button>
          <button 
            onClick={() => setIsAdding(true)}
            style={{ background: 'var(--accent-primary)', color: 'white', padding: '0.8rem 1.5rem', borderRadius: '12px', border: 'none', cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center', fontWeight: '600' }}
          >
            <Plus size={20} /> إضافة جديد
          </button>
        </div>
      </div>

      {isBulkUploading && (
        <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '2rem', borderRadius: '24px', border: '1px dashed var(--accent-primary)', marginBottom: '2rem', textAlign: 'center' }}>
          <Upload size={40} color="var(--accent-primary)" style={{ margin: '0 auto 1rem auto' }} />
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--accent-primary)' }}>رفع المنيو أو الخدمات دفعة واحدة</h3>
          <p style={{ color: 'var(--text-dim)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>يمكنك رفع ملف CSV أو Excel يحتوي على (الاسم، السعر، رابط الصورة). سيتم قراءته وإضافته للذكاء الاصطناعي فوراً.</p>
          <input type="file" accept=".csv, .xlsx" style={{ display: 'none' }} id="file-upload" />
          <label htmlFor="file-upload" style={{ background: 'var(--accent-primary)', color: 'white', padding: '0.6rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
            اختر ملف
          </label>
          <button onClick={() => setIsBulkUploading(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', marginLeft: '1rem', cursor: 'pointer' }}>إلغاء</button>
        </div>
      )}

      {isAdding && (
        <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--accent-primary)', marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>إضافة خدمة جديدة</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <input 
              placeholder={`اسم ${dict.item} (مثلاً: استشارة / منتج)`} 
              value={newItem.name} 
              onChange={e => setNewItem({...newItem, name: e.target.value})}
              style={{ background: 'var(--bg-color)', border: '1px solid var(--glass-border)', padding: '0.8rem', borderRadius: '10px', color: 'var(--text-main)', outline: 'none' }}
            />
            <input 
              placeholder="السعر (ج.م)" 
              type="number"
              value={newItem.price} 
              onChange={e => setNewItem({...newItem, price: e.target.value})}
              style={{ background: 'var(--bg-color)', border: '1px solid var(--glass-border)', padding: '0.8rem', borderRadius: '10px', color: 'var(--text-main)', outline: 'none' }} 
            />
            <input 
              placeholder="المدة (بالدقائق)" 
              type="number"
              value={newItem.duration} 
              onChange={e => setNewItem({...newItem, duration: e.target.value})}
              style={{ background: 'var(--bg-color)', border: '1px solid var(--glass-border)', padding: '0.8rem', borderRadius: '10px', color: 'var(--text-main)', outline: 'none' }}
            />
          </div>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
            <button onClick={handleAddItem} style={{ background: 'var(--accent-primary)', color: 'white', padding: '0.6rem 2rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600 }}>حفظ</button>
            <button onClick={() => setIsAdding(false)} style={{ background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--glass-border)', padding: '0.6rem 2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>إلغاء</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {items.map(item => (
          <div key={item.id} style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--glass-border)', position: 'relative' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {tenant?.type === 'clinic' ? <Stethoscope size={20} color="var(--accent-primary)" /> : <Utensils size={20} color="var(--accent-secondary)" />}
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '0.2rem' }}>{item.name}</h4>
                <div style={{ color: 'var(--accent-primary)', fontWeight: '800', fontSize: '1.2rem' }}>{item.price} <span style={{ fontSize: '0.8rem', fontWeight: '400' }}>ج.م</span></div>
                <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.5rem' }}>المدة المتوقعة: {item.duration_minutes} دقيقة</div>
              </div>
            </div>
            <div style={{ position: 'absolute', top: '1rem', left: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => deleteItem(item.id)} style={{ background: 'transparent', border: 'none', color: '#ff4b4b', cursor: 'pointer' }}><Trash2 size={18} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ServicesPage;
