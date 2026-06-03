import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { deleteCalendarEvent } from '@/lib/googleCalendar';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      // GHOST DEFENDER: Honeytoken / Fail-Safe response
      console.warn('Ghost Defender: Unauthorized delete attempt blocked.');
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const params = await props.params;
    const bookingId = params.id;
    const supabaseAdmin = getSupabaseAdminClient();
    
    // 1. Fetch booking to get google_event_id and tenant_id
    const { data: booking } = await supabaseAdmin.from('bookings').select('*').eq('id', bookingId).single();
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // OBJECT-LEVEL AUTHORIZATION: Verify user owns the tenant that owns this booking
    const { data: tenantData } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('id', booking.tenant_id)
      .eq('user_id', user.id)
      .single();

    if (!tenantData) {
      const { data: profileAccess } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('tenant_id', booking.tenant_id)
        .eq('id', user.id)
        .single();
        
      if (!profileAccess) {
        console.warn(`Ghost Defender: Horizontal Privilege Escalation blocked. User ${user.id} tried to delete booking ${bookingId} from tenant ${booking.tenant_id}`);
        return NextResponse.json({ error: 'Forbidden: You do not have access to this Object' }, { status: 403 });
      }
    }

    // 2. Delete from Google Calendar if event exists
    if (booking.google_event_id) {
      const { data: teamMembers } = await supabaseAdmin
        .from('team_members')
        .select('google_calendar_refresh_token')
        .eq('tenant_id', booking.tenant_id)
        .not('google_calendar_refresh_token', 'is', null)
        .limit(1);

      const { data: tenant } = await supabaseAdmin.from('tenants').select('google_calendar_refresh_token').eq('id', booking.tenant_id).single();

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
    const { error } = await supabaseAdmin.from('bookings').delete().eq('id', bookingId);
    if (error) throw error;

    // 4. Send WhatsApp Cancellation Message
    if (booking.customer_phone) {
      const { data: tenantDetails } = await supabaseAdmin
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
          await supabaseAdmin.from('messages').insert({
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
