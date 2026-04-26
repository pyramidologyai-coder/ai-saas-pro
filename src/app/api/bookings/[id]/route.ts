import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { deleteCalendarEvent } from '@/lib/googleCalendar';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const bookingId = params.id;
    
    // 1. Fetch booking to get google_event_id and tenant_id
    const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // 2. Delete from Google Calendar if event exists
    if (booking.google_event_id) {
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('google_calendar_refresh_token')
        .eq('tenant_id', booking.tenant_id)
        .not('google_calendar_refresh_token', 'is', null)
        .limit(1);

      const { data: tenant } = await supabase.from('tenants').select('google_calendar_refresh_token').eq('id', booking.tenant_id).single();

      const refreshToken = teamMembers && teamMembers.length > 0 
        ? teamMembers[0].google_calendar_refresh_token 
        : tenant?.google_calendar_refresh_token;

      if (refreshToken) {
        try {
          await deleteCalendarEvent(refreshToken, booking.google_event_id);
        } catch (calError) {
          console.error('Failed to delete from Google Calendar:', calError);
        }
      }
    }

    // 3. Delete from Supabase
    const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
    if (error) throw error;

    // 4. Send WhatsApp Cancellation Message
    if (booking.customer_phone) {
      const { data: tenantDetails } = await supabase
        .from('tenants')
        .select('name, meta_token, whatsapp_number_id')
        .eq('id', booking.tenant_id)
        .single();
        
      if (tenantDetails?.meta_token && tenantDetails?.whatsapp_number_id) {
        try {
          const appointmentDate = new Date(booking.booking_time).toLocaleString('ar-EG', { 
            timeZone: 'Africa/Cairo',
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric'
          });

          const message = `عذراً أستاذ/ة ${booking.customer_name}،\nنعتذر لإبلاغك بأنه قد تم إلغاء حجزك في "${tenantDetails.name}".\n\nتفاصيل الحجز الملغى:\nالخدمة: ${booking.service_name || 'غير محدد'}\nالموعد: ${appointmentDate}\n\nيرجى التواصل معنا لتحديد موعد آخر أو لأي استفسار.`;
          
          await sendWhatsAppMessage(booking.customer_phone, message, tenantDetails.whatsapp_number_id, tenantDetails.meta_token);

          // Save cancellation message to history so AI knows!
          await supabase.from('messages').insert({
            tenant_id: booking.tenant_id,
            session_id: booking.customer_phone,
            sender: 'ai',
            text: message
          });
        } catch (waError) {
          console.error('Failed to send WhatsApp cancellation message:', waError);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Booking Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
