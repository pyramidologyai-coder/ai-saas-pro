import { NextResponse } from 'next/server';
import { authorizeCronRequest } from '@/lib/cron-auth';
import { getDictionary } from '@/lib/dictionary';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

// Important: This endpoint should be triggered by a Cron Job (e.g., Vercel Cron) every hour.
export async function GET(request: Request) {
  const authError = authorizeCronRequest(request);
  if (authError) return authError;

  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const now = new Date();
    
    // 1. Process 24-Hour Reminders
    const tomorrowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23 hours from now
    const tomorrowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);   // 25 hours from now

    const { data: upcomingBookings, error: err1 } = await supabaseAdmin
      .from('bookings')
      .select('*, tenants(name, type, whatsapp_number_id, meta_token, enable_reminders)')
      .gte('booking_time', tomorrowStart.toISOString())
      .lte('booking_time', tomorrowEnd.toISOString())
      .eq('reminder_sent', false);

    if (err1) console.error('Error fetching upcoming bookings:', err1);

    for (const booking of upcomingBookings || []) {
      const tenant = booking.tenants;
      if (!tenant || !tenant.meta_token || !tenant.whatsapp_number_id || tenant.enable_reminders === false) continue;
      
      const dict = getDictionary(tenant.type);
      const bookingTime = new Date(booking.booking_time).toLocaleString('ar-EG', { 
        weekday: 'long', hour: 'numeric', minute: 'numeric', hour12: true 
      });

      const messageText = `مرحباً ${booking.customer_name}،\nنذكركم بـ ${dict.bookings} الخاص بكم في ${tenant.name} غداً (${bookingTime}).\n\nللتأكيد أو الإلغاء، يرجى الرد على هذه الرسالة.`;

      // Send WhatsApp Message via Meta API
      await fetch(`https://graph.facebook.com/v18.0/${tenant.whatsapp_number_id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tenant.meta_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: booking.customer_phone,
          type: 'text',
          text: { body: messageText }
        })
      });

      // Mark as sent
      await supabaseAdmin.from('bookings').update({ reminder_sent: true }).eq('id', booking.id);
      console.log(`[CRON] Reminder sent to ***${String(booking.customer_phone).slice(-4)} (booking: ${booking.id})`);
    }

    // 2. Process Post-Visit Review Requests (2 hours after booking)
    const pastStart = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3 hours ago
    const pastEnd = new Date(now.getTime() - 1 * 60 * 60 * 1000);   // 1 hour ago

    const { data: pastBookings, error: err2 } = await supabaseAdmin
      .from('bookings')
      .select('*, tenants(name, type, whatsapp_number_id, meta_token, google_review_link, enable_reviews)')
      .gte('booking_time', pastStart.toISOString())
      .lte('booking_time', pastEnd.toISOString())
      .eq('followup_sent', false);

    if (err2) console.error('Error fetching past bookings:', err2);

    for (const booking of pastBookings || []) {
      const tenant = booking.tenants;
      if (!tenant || !tenant.meta_token || !tenant.whatsapp_number_id || tenant.enable_reviews === false) continue;

      const reviewLink = tenant.google_review_link || 'https://google.com';

      const messageText = `أهلاً ${booking.customer_name}،\nنتمنى أن تكون تجربتك في ${tenant.name} قد نالت إعجابك.\nيسعدنا جداً تقييمك لنا بخمس نجوم عبر الرابط التالي: ⭐⭐⭐⭐⭐\n${reviewLink}\n\nشكراً لثقتك بنا!`;

      // Send WhatsApp Message via Meta API
      await fetch(`https://graph.facebook.com/v18.0/${tenant.whatsapp_number_id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tenant.meta_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: booking.customer_phone,
          type: 'text',
          text: { body: messageText }
        })
      });

      // Mark as sent
      await supabaseAdmin.from('bookings').update({ followup_sent: true }).eq('id', booking.id);
      console.log(`[CRON] Follow-up sent to ***${String(booking.customer_phone).slice(-4)} (booking: ${booking.id})`);
    }

    return NextResponse.json({ success: true, processedReminders: upcomingBookings?.length || 0, processedFollowups: pastBookings?.length || 0 });

  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
