import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createBooking } from '@/lib/bookings';
import { createCalendarEvent } from '@/lib/googleCalendar';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { tenant_id, customer_name, customer_phone, service_name, booking_time } = body;

    if (!tenant_id || !customer_name || !customer_phone || !booking_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // IDOR Protection: Verify that the authenticated user actually owns/has access to this tenant_id
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', tenant_id)
      .eq('user_id', user.id)
      .single();
      
    if (!tenantData) {
      // Try to check if they have access via profiles (RBAC)
      const { data: profileAccess } = await supabase
        .from('profiles')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('id', user.id) // Assuming profiles.id == auth.users.id
        .single();
        
      if (!profileAccess) {
        return NextResponse.json({ error: 'Forbidden: You do not have access to this Workspace' }, { status: 403 });
      }
    }

    // Normalize Egyptian Phone Numbers automatically
    let formattedPhone = customer_phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('01')) {
      formattedPhone = '2' + formattedPhone;
    }

    const { data: booking, error: dbError } = await supabase
      .from('bookings')
      .insert({
        tenant_id,
        customer_name,
        customer_phone: formattedPhone,
        service_name: service_name || 'حجز يدوي',
        booking_time,
        source: 'web'
      })
      .select('*')
      .single();

    if (dbError) throw dbError;

    // 2. Sync to Google Calendar
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('google_calendar_refresh_token')
      .eq('tenant_id', tenant_id)
      .not('google_calendar_refresh_token', 'is', null)
      .limit(1);

    const { data: tenant } = await supabase
      .from('tenants')
      .select('google_calendar_refresh_token, meta_token, whatsapp_number_id, name')
      .eq('id', tenant_id)
      .single();

    const refreshToken = teamMembers && teamMembers.length > 0 
      ? teamMembers[0].google_calendar_refresh_token 
      : tenant?.google_calendar_refresh_token;

    if (refreshToken) {
      try {
        const startDate = new Date(booking_time);
        const endDate = new Date(startDate.getTime() + 30 * 60000); // 30 min default
        
        const calResponse = await createCalendarEvent(refreshToken, {
          summary: `حجز: ${customer_name}`,
          description: `الخدمة: ${service_name || 'غير محدد'}\nرقم التليفون: ${formattedPhone}\nتم الحجز يدوياً من لوحة التحكم.`,
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        });
        
        if (calResponse.id && booking) {
          await supabase.from('bookings').update({ google_event_id: calResponse.id }).eq('id', booking.id);
        }
      } catch (calError) {
        console.error('Failed to sync manual booking to Calendar:', calError);
      }
    }

    // 3. Send WhatsApp Confirmation
    if (tenant?.meta_token && tenant?.whatsapp_number_id) {
      try {
        const appointmentDate = new Date(booking_time).toLocaleString('ar-EG', { 
          timeZone: 'Africa/Cairo',
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric'
        });

        const message = `أهلاً بك أستاذ/ة ${customer_name}،\nتم تأكيد حجزك في "${tenant.name}" بنجاح ✅\n\nالخدمة: ${service_name || 'غير محدد'}\nالموعد: ${appointmentDate}\n\nنتمنى لك يوماً سعيداً!`;
        
        await sendWhatsAppMessage(formattedPhone, message, tenant.whatsapp_number_id, tenant.meta_token);
      } catch (waError) {
        console.error('Failed to send WhatsApp confirmation:', waError);
      }
    }

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    console.error('Manual Booking Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
