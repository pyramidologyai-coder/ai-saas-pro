'use client';

import React, { useState, useEffect } from 'react';
import styles from './Bookings.module.css';
import { ChevronLeft, ChevronRight, Plus, Filter, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import 'react-phone-number-input/style.css';
import PhoneInput from 'react-phone-number-input';

import { getActiveTenant } from '@/lib/tenant';

const BookingsPage = () => {
  const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const [realBookings, setRealBookings] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'Day' | 'Week' | 'Month'>('Day');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [dayBookingsModal, setDayBookingsModal] = useState<any[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    service_name: '',
    booking_date: '',
    booking_time: ''
  });
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBookings() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/auth';
        return;
      }
      
      const tenant = await getActiveTenant(session.user);
      if (tenant) setTenantId(tenant.id);
      
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('tenant_id', tenant?.id)
        .order('booking_time', { ascending: true });
      
      if (data) {
        setRealBookings(data);
      }
      setLoading(false);
    }
    fetchBookings();
  }, []);

  const exportToCSV = () => {
    if (realBookings.length === 0) {
      alert("لا يوجد حجوزات لتحميلها");
      return;
    }
    const headers = ["رقم الحجز", "اسم العميل", "رقم الهاتف", "الخدمة المطلوبة", "وقت الحجز", "المصدر"];
    const csvContent = [
      headers.join(","),
      ...realBookings.map(b => [
        b.id,
        `"${b.customer_name || 'غير معروف'}"`,
        b.customer_phone || 'غير معروف',
        `"${b.service_name || 'غير محدد'}"`,
        `"${new Date(b.booking_time).toLocaleString('ar-EG')}"`,
        b.source === 'whatsapp' ? 'واتساب' : 'موقع إلكتروني'
      ].join(","))
    ].join("\n");

    // Add BOM for proper Arabic support in Excel
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `الحجوزات_${new Date().toLocaleDateString('en-GB')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleManualBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return alert('Session error');
    setIsSubmitting(true);
    
    try {
      const combinedDateTime = `${formData.booking_date}T${formData.booking_time}`;
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          service_name: formData.service_name,
          booking_time: combinedDateTime
        })
      });

      const data = await res.json();
      if (data.success) {
        alert('تم الحجز بنجاح! تم تسجيل الموعد في التقويم وإرسال رسالة واتساب للعميل.');
        setShowModal(false);
        setFormData({ customer_name: '', customer_phone: '', service_name: '', booking_date: '', booking_time: '' });
        // Refresh bookings
        const { data: newBookings } = await supabase.from('bookings').select('*').eq('tenant_id', tenantId).order('booking_time', { ascending: true });
        if (newBookings) setRealBookings(newBookings);
      } else {
        alert('حدث خطأ: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('خطأ في الاتصال بالسيرفر');
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من إلغاء هذا الحجز؟ سيتم حذفه من النظام ومن جوجل كالندر.')) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/bookings/${id}`, { 
        method: 'DELETE',
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
      });
      
      if (res.ok) {
        setRealBookings(realBookings.filter(b => b.id !== id));
        if (dayBookingsModal) {
          setDayBookingsModal(dayBookingsModal.filter(b => b.id !== id));
        }
      } else {
        alert('فشل الإلغاء');
      }
    } catch (err) {
      alert('خطأ في الاتصال');
    }
  };

  // Generate calendar days for the current month
  const todayDate = new Date();
  const year = todayDate.getFullYear();
  const month = todayDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const calendarDays = Array.from({ length: 42 }, (_, i) => {
    const dayNumber = i - firstDayOfMonth + 1;
    const isCurrentMonth = dayNumber > 0 && dayNumber <= daysInMonth;
    
    if (!isCurrentMonth) {
      return { day: null, isCurrentMonth: false, isToday: false, bookings: [] };
    }

    const dayBookings = realBookings.filter(b => {
      const bDate = new Date(b.booking_time);
      return bDate.getDate() === dayNumber && bDate.getMonth() === month && bDate.getFullYear() === year;
    });

    return {
      day: dayNumber,
      isCurrentMonth: true,
      isToday: dayNumber === todayDate.getDate() && month === new Date().getMonth() && year === new Date().getFullYear(),
      bookings: dayBookings.map(b => ({
        id: b.id,
        title: `${b.customer_name || 'عميل'} ${b.source === 'whatsapp' ? '📱' : '🌐'}`,
        type: 'clinic',
        time: new Date(b.booking_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      }))
    };
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>جدول الحجوزات</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className={styles.iconBtn} style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', padding: '0.5rem', borderRadius: '10px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={18} />
            فلترة
          </button>
          <button onClick={exportToCSV} className={styles.iconBtn} style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', padding: '0.5rem 1rem', borderRadius: '10px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <Download size={18} />
            تصدير إكسيل
          </button>
          <button onClick={() => setShowModal(true)} style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '12px', color: 'white', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <Plus size={20} />
            حجز يدوي
          </button>
        </div>
      </div>

      {/* Manual Booking Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '20px', width: '90%', maxWidth: '400px', border: '1px solid var(--glass-border)' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-main)' }}>إضافة حجز يدوي</h2>
            <form onSubmit={handleManualBooking} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input required type="text" placeholder="اسم العميل" value={formData.customer_name} onChange={e => setFormData({...formData, customer_name: e.target.value})} style={{ padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
              <PhoneInput
                international
                defaultCountry="EG"
                placeholder="رقم الهاتف"
                value={formData.customer_phone}
                onChange={(val) => setFormData({...formData, customer_phone: val || ''})}
                style={{ padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-main)', color: 'var(--text-main)', direction: 'ltr' }}
              />
              <input required type="text" placeholder="الخدمة المطلوبة" value={formData.service_name} onChange={e => setFormData({...formData, service_name: e.target.value})} style={{ padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input required type="date" value={formData.booking_date} onChange={e => setFormData({...formData, booking_date: e.target.value})} style={{ flex: 1, padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                <input required type="time" value={formData.booking_time} onChange={e => setFormData({...formData, booking_time: e.target.value})} style={{ flex: 1, padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-main)', cursor: 'pointer' }}>إلغاء</button>
                <button type="submit" disabled={isSubmitting} style={{ flex: 1, padding: '0.8rem', background: 'var(--accent-primary)', border: 'none', borderRadius: '10px', color: 'white', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>{isSubmitting ? 'جاري الحفظ...' : 'تأكيد الحجز'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Day Bookings List Modal */}
      {dayBookingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '20px', width: '90%', maxWidth: '500px', border: '1px solid var(--glass-border)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ color: 'var(--text-main)', margin: 0 }}>تفاصيل حجوزات اليوم</h2>
              <button onClick={() => setDayBookingsModal(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
              {dayBookingsModal.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>لا يوجد حجوزات</p>
              ) : (
                dayBookingsModal.map((booking: any) => (
                  <div key={booking.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{booking.title}</div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', marginTop: '0.2rem' }}>🕒 {booking.time}</div>
                    </div>
                    <button 
                      onClick={() => handleDelete(booking.id)} 
                      style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                    >
                      إلغاء الحجز
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters mimicking MySchedule */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)', padding: '1rem 1.5rem', borderRadius: '16px', marginBottom: '1.5rem', border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>أبريل 23, 2026</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '0.4rem', borderRadius: '8px', cursor: 'pointer' }}><ChevronLeft size={16} /></button>
            <button style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '0.4rem', borderRadius: '8px', cursor: 'pointer' }}><ChevronRight size={16} /></button>
          </div>
        </div>

        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', padding: '0.3rem', border: '1px solid var(--glass-border)' }}>
          <button onClick={() => setViewMode('Day')} style={{ background: viewMode === 'Day' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'Day' ? 'white' : 'var(--text-main)', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: '0.2s' }}>يومي</button>
          <button onClick={() => setViewMode('Week')} style={{ background: viewMode === 'Week' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'Week' ? 'white' : 'var(--text-main)', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: '0.2s' }}>أسبوعي</button>
          <button onClick={() => setViewMode('Month')} style={{ background: viewMode === 'Month' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'Month' ? 'white' : 'var(--text-main)', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: '0.2s' }}>شهري</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <select style={{ padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--card-bg)', color: 'var(--text-main)', flex: 1, outline: 'none' }}>
          <option>كل الأطباء (All Doctors)</option>
          <option>د. أحمد (جلدية)</option>
          <option>د. نورة (طبيب ذكاء اصطناعي)</option>
        </select>
        <select style={{ padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--card-bg)', color: 'var(--text-main)', flex: 1, outline: 'none' }}>
          <option>كل التخصصات (Specialties)</option>
          <option>أسنان</option>
          <option>جلدية</option>
        </select>
      </div>

      <div className={styles.calendarContainer}>
        {/* Left Sidebar Stats */}
        <div className={styles.sidebar}>
          <h3 className={styles.sidebarTitle}>ملخص الشهر</h3>
          
          <div className={styles.statItem}>
            <span className={styles.statLabel}>إجمالي الحجوزات</span>
            <div className={styles.statValue}>{loading ? '...' : realBookings.length}</div>
          </div>

          <div className={styles.statItem}>
            <span className={styles.statLabel}>حجوزات الواتساب 📱</span>
            <div className={styles.statValue} style={{ color: 'var(--accent-primary)' }}>
              {loading ? '...' : realBookings.filter(b => b.source === 'whatsapp').length}
            </div>
          </div>

          <div className={styles.statItem}>
            <span className={styles.statLabel}>حجوزات الويب 🌐</span>
            <div className={styles.statValue} style={{ color: 'var(--accent-secondary)' }}>
              {loading ? '...' : realBookings.filter(b => b.source === 'web').length}
            </div>
          </div>
        </div>

        {/* Main Calendar Grid */}
        <div className={styles.main}>
          <div className={styles.calendarHeader}>
            <h2 style={{ color: 'var(--text-main)' }}>أبريل 2026</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button style={{ background: 'none', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '4px', borderRadius: '6px' }}><ChevronLeft size={20} /></button>
              <button style={{ background: 'none', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '4px', borderRadius: '6px' }}><ChevronRight size={20} /></button>
            </div>
          </div>

          <div className={styles.calendarGrid}>
            {days.map(day => (
              <div key={day} className={styles.dayHeader}>{day}</div>
            ))}
            
            {calendarDays.map((item, idx) => {
              const visibleBookings = item.bookings.slice(0, 3);
              const remainingCount = item.bookings.length - 3;
              
              return (
                <div key={idx} className={`${styles.dayCell} ${item.isToday ? styles.today : ''} ${!item.day ? styles.emptyCell : ''}`}>
                  {item.day && <span className={styles.dayNumber}>{item.day}</span>}
                  {visibleBookings.map((booking: any) => (
                    <div key={booking.id} className={styles.bookingEntry} title={booking.time} style={{ position: 'relative', paddingRight: '20px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <button onClick={() => handleDelete(booking.id)} style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>×</button>
                      {booking.title} - {booking.time}
                    </div>
                  ))}
                  {remainingCount > 0 && (
                    <button 
                      onClick={() => setDayBookingsModal(item.bookings)}
                      style={{
                        width: '100%',
                        textAlign: 'center',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        color: 'var(--accent-primary)',
                        background: 'rgba(99, 102, 241, 0.1)',
                        padding: '4px 0',
                        borderRadius: '6px',
                        marginTop: 'auto',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'}
                    >
                      +{remainingCount} المزيد
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingsPage;
