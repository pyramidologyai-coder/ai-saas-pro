import { NextResponse } from 'next/server';
import { processIncomingMessage } from '@/lib/ai-agent';
import { createBooking } from '@/lib/bookings';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { createCalendarEvent } from '@/lib/googleCalendar';

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'my_secure_token_123';

// Webhook Verification (GET)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// Message Processing (POST)
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Check if it's a WhatsApp message
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (message && message.type === 'text') {
        const from = message.from; // Customer phone number
        const text = message.text.body;
        const businessPhoneNumberId = value?.metadata?.phone_number_id;

        // 1. Find Tenant by Business Phone Number
        const { data: tenant } = await supabase
          .from('tenants')
          .select('*')
          .eq('whatsapp_number_id', businessPhoneNumberId)
          .single();

        if (!tenant) {
          console.error(`[Webhook Error] Tenant not found for Phone ID: ${businessPhoneNumberId}`);
          return NextResponse.json({ status: 'ok' });
        }

        // Check if trial is expired
        if (tenant.trial_ends_at) {
          const expirationDate = new Date(tenant.trial_ends_at);
          if (new Date() > expirationDate) {
            // Trial expired, send automated message
            await sendWhatsAppMessage(
              from, 
              `عذراً، هذه الخدمة (الرد الآلي لـ ${tenant.name}) غير متاحة مؤقتاً لتوقف الاشتراك. يرجى الاتصال بنا هاتفياً للحجز.`,
              businessPhoneNumberId,
              tenant.meta_token
            );
            return NextResponse.json({ status: 'ok' });
          }
        }

        // 1.5 Prevent Meta Webhook Retries (Deduplication)
        // If we received the exact same text from the same user in the last 3 minutes, it's a retry.
        const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        const { data: recentMessages } = await supabase
          .from('messages')
          .select('id')
          .eq('session_id', from)
          .eq('sender', 'incoming')
          .eq('text', text)
          .gte('created_at', threeMinutesAgo);

        if (recentMessages && recentMessages.length > 0) {
          console.log(`[Webhook] Ignored duplicate message from Meta retry: ${text}`);
          return NextResponse.json({ status: 'ok' });
        }

        // 2. Save incoming message
        await supabase.from('messages').insert({
          tenant_id: tenant.id,
          session_id: from,
          sender: 'incoming',
          text: text
        });

        // 3. Fetch History (last 60 messages)
        const { data: historyData } = await supabase
          .from('messages')
          .select('sender, text')
          .eq('session_id', from)
          .order('created_at', { ascending: false })
          .limit(60);
        
        const history = (historyData || []).reverse();

        // 4. Process with AI
        const aiResponse = await processIncomingMessage(text, tenant.id, history, from);

        // 4. Send Message back to WhatsApp FIRST so the user doesn't wait
        console.log(`Sending to ${from}: ${aiResponse.replyMessage}`);
        await sendWhatsAppMessage(from, aiResponse.replyMessage, businessPhoneNumberId, tenant.meta_token);

        // 5. Save AI outgoing message
        await supabase.from('messages').insert({
          tenant_id: tenant.id,
          session_id: from,
          sender: 'ai',
          text: aiResponse.replyMessage
        });

        // 6. If Booking detected, save it
        if (aiResponse.intent === 'book' && aiResponse.bookings && aiResponse.bookings.length > 0) {
          for (const bookingData of aiResponse.bookings) {
            if (!bookingData.bookingTime) continue;

            // Prevent duplicates (webhook retry issue)
            const { data: existingBooking } = await supabase
              .from('bookings')
              .select('id')
              .eq('tenant_id', tenant.id)
              .eq('customer_phone', from)
              .eq('booking_time', bookingData.bookingTime)
              .single();

            if (existingBooking) {
              console.log('Booking already exists, skipping duplicate.');
              continue;
            }

            const { data: newBooking } = await supabase.from('bookings').insert({
              tenant_id: tenant.id,
              customer_name: bookingData.customerName || 'عميل واتساب',
              customer_phone: from,
              booking_time: bookingData.bookingTime,
              service_name: bookingData.serviceName || 'كشف',
              source: 'whatsapp'
            }).select().single();

            // Sync with Google Calendar if connected
            const { data: teamMembers } = await supabase
              .from('team_members')
              .select('google_calendar_refresh_token')
              .eq('tenant_id', tenant.id)
              .not('google_calendar_refresh_token', 'is', null)
              .limit(1);
              
            const refreshToken = teamMembers && teamMembers.length > 0 
              ? teamMembers[0].google_calendar_refresh_token 
              : tenant.google_calendar_refresh_token;

            if (refreshToken && newBooking) {
              try {
                const startDate = new Date(bookingData.bookingTime);
                const endDate = new Date(startDate.getTime() + 30 * 60000);
                
                const calResponse = await createCalendarEvent(refreshToken, {
                  summary: `حجز: ${bookingData.customerName || 'عميل واتساب'}`,
                  description: `الخدمة: ${bookingData.serviceName || 'كشف'}\nرقم التليفون: ${from}\nتم الحجز تلقائياً عبر الذكاء الاصطناعي على الواتساب.`,
                  startTime: startDate.toISOString(),
                  endTime: endDate.toISOString(),
                });
                
                if (calResponse.id) {
                  await supabase.from('bookings').update({ google_event_id: calResponse.id }).eq('id', newBooking.id);
                }
                console.log('Successfully synced booking to Google Calendar.');
              } catch (calError) {
                console.error('Failed to sync with Google Calendar:', calError);
              }
            }
          }
        }

        // 7. If Cancel detected, delete it
        if (aiResponse.intent === 'cancel') {
          // Find the customer's upcoming booking
          const { data: bookingsToCancel } = await supabase
            .from('bookings')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('customer_phone', from)
            .gte('booking_time', new Date().toISOString());

          if (bookingsToCancel && bookingsToCancel.length > 0) {
            for (const booking of bookingsToCancel) {
              // Delete from Google Calendar if it has an event ID
              if (booking.google_event_id) {
                const { data: teamMembers } = await supabase
                  .from('team_members')
                  .select('google_calendar_refresh_token')
                  .eq('tenant_id', tenant.id)
                  .not('google_calendar_refresh_token', 'is', null)
                  .limit(1);
                  
                const refreshToken = teamMembers && teamMembers.length > 0 
                  ? teamMembers[0].google_calendar_refresh_token 
                  : tenant.google_calendar_refresh_token;

                if (refreshToken) {
                  try {
                    const { deleteCalendarEvent } = await import('@/lib/googleCalendar');
                    await deleteCalendarEvent(refreshToken, booking.google_event_id);
                  } catch (e) {
                    console.error('Failed to delete calendar event', e);
                  }
                }
              }
              // Delete from Supabase
              await supabase.from('bookings').delete().eq('id', booking.id);
            }
          }
        }

      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}


