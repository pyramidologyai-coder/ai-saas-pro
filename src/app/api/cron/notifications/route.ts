import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables.');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();

    // 1. Reminders — bookings in the next 24 hours
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: upcomingBookings, error: reminderError } = await supabaseAdmin
      .from('bookings')
      .select('*, tenants(name, whatsapp_number_id, meta_token)')
      .eq('reminder_sent', false)
      .eq('status', 'pending')
      .gte('booking_time', now.toISOString())
      .lte('booking_time', tomorrow.toISOString());

    if (reminderError) console.error('[CRON] Reminder query error:', reminderError);

    let remindersSent = 0;
    for (const booking of upcomingBookings || []) {
      const tenant = booking.tenants;
      if (!booking.customer_phone || !tenant?.whatsapp_number_id || !tenant?.meta_token) continue;

      const bookingDate = new Date(booking.booking_time);
      const timeString = bookingDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
      const dateString = bookingDate.toLocaleDateString('ar-EG');

      const messageText = `أهلاً يا ${booking.customer_name} 👋\nبنفكرك بميعادك في ${tenant.name} بكره ${dateString} الساعة ${timeString}.\nفي انتظارك!`;

      await sendWhatsAppMessage(booking.customer_phone, messageText, tenant.whatsapp_number_id, tenant.meta_token);
      await supabaseAdmin.from('bookings').update({ reminder_sent: true }).eq('id', booking.id);
      console.log(`[CRON] Reminder sent (booking: ${booking.id})`);
      remindersSent++;
    }

    // 2. Follow-ups — bookings that ended 2–24 hours ago
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: pastBookings, error: followupError } = await supabaseAdmin
      .from('bookings')
      .select('*, tenants(name, google_review_link, whatsapp_number_id, meta_token)')
      .eq('followup_sent', false)
      .lte('booking_time', twoHoursAgo.toISOString())
      .gte('booking_time', yesterday.toISOString());

    if (followupError) console.error('[CRON] Followup query error:', followupError);

    let followupsSent = 0;
    for (const booking of pastBookings || []) {
      const tenant = booking.tenants;
      if (!booking.customer_phone || !tenant?.whatsapp_number_id || !tenant?.meta_token) continue;

      const reviewLink = tenant.google_review_link || '';
      const messageText = `أهلاً يا ${booking.customer_name} 🌟\nنتمنى تكون بخير بعد زيارتك لـ ${tenant.name}!\nرأيك يهمنا جداً، ياريت تشاركنا تقييمك على جوجل:\n${reviewLink}\n\nلو في أي استفسار إحنا دايماً موجودين!`;

      await sendWhatsAppMessage(booking.customer_phone, messageText, tenant.whatsapp_number_id, tenant.meta_token);
      await supabaseAdmin.from('bookings').update({ followup_sent: true }).eq('id', booking.id);
      console.log(`[CRON] Follow-up sent (booking: ${booking.id})`);
      followupsSent++;
    }

    return NextResponse.json({
      status: 'success',
      message: `Sent ${remindersSent} reminders and ${followupsSent} follow-ups.`
    });

  } catch (error) {
    console.error('[CRON] Notifications error:', error);
    return NextResponse.json({ status: 'error', message: 'Internal Server Error' }, { status: 500 });
  }
}