import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic'; // Prevent caching so cron runs correctly

export async function GET(req: Request) {
  try {
    const now = new Date();
    
    // ---------------------------------------------------------
    // 1. SEND REMINDERS (Bookings in the next 24 hours)
    // ---------------------------------------------------------
    // We look for bookings between NOW and NOW + 24 hours
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const { data: upcomingBookings, error: reminderError } = await supabase
      .from('bookings')
      .select('*, tenants(name, google_review_link)')
      .eq('reminder_sent', false)
      .eq('status', 'pending')
      .gte('booking_time', now.toISOString())
      .lte('booking_time', tomorrow.toISOString());

    if (reminderError) console.error('Reminder Query Error:', reminderError);

    let remindersSent = 0;
    if (upcomingBookings && upcomingBookings.length > 0) {
      for (const booking of upcomingBookings) {
        if (!booking.customer_phone) continue;
        
        // Format time (e.g. 7:00 PM)
        const bookingDate = new Date(booking.booking_time);
        const timeString = bookingDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        const dateString = bookingDate.toLocaleDateString('ar-EG');
        const clinicName = booking.tenants?.name || 'النشاط';

        const messageText = `أهلاً يا ${booking.customer_name} 👋\nبنفكرك بميعادك في ${clinicName} بكره ${dateString} الساعة ${timeString}.\nفي انتظارك!`;

        await sendWhatsAppMessage(booking.customer_phone, messageText);
        
        // Mark as sent
        await supabase.from('bookings').update({ reminder_sent: true }).eq('id', booking.id);
        remindersSent++;
      }
    }

    // ---------------------------------------------------------
    // 2. SEND FOLLOW-UPS (Bookings that passed 2 hours ago)
    // ---------------------------------------------------------
    // We look for bookings that were between 24 hours ago and 2 hours ago
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: pastBookings, error: followupError } = await supabase
      .from('bookings')
      .select('*, tenants(name, google_review_link)')
      .eq('followup_sent', false)
      .lte('booking_time', twoHoursAgo.toISOString())
      .gte('booking_time', yesterday.toISOString());

    if (followupError) console.error('Followup Query Error:', followupError);

    let followupsSent = 0;
    if (pastBookings && pastBookings.length > 0) {
      for (const booking of pastBookings) {
        if (!booking.customer_phone) continue;
        
        const clinicName = booking.tenants?.name || 'النشاط';
        const reviewLink = booking.tenants?.google_review_link || '';

        const messageText = `أهلاً يا ${booking.customer_name} 🌟\nنتمنى تكون بخير بعد زيارتك لـ ${clinicName}!\nرأيك يهمنا جداً وبيساعدنا نطور من نفسنا، ياريت تشاركنا تجربتك وتقييمك على جوجل من اللينك ده:\n${reviewLink}\n\nلو في أي مشكلة أو استفسار، إحنا دايماً موجودين عشان نساعدك!`;

        await sendWhatsAppMessage(booking.customer_phone, messageText);
        
        // Mark as sent
        await supabase.from('bookings').update({ followup_sent: true }).eq('id', booking.id);
        followupsSent++;
      }
    }

    return NextResponse.json({ 
      status: 'success', 
      message: `Sent ${remindersSent} reminders and ${followupsSent} follow-ups.` 
    });

  } catch (error) {
    console.error('Cron Error:', error);
    return NextResponse.json({ status: 'error', message: 'Internal Server Error' }, { status: 500 });
  }
}
