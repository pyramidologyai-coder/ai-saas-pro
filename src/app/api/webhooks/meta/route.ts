export const maxDuration = 60; // Allow Vercel to run up to 60s
import { NextResponse } from 'next/server';
import { processIncomingMessage } from '@/lib/ai-agent';
import { createBooking } from '@/lib/bookings';
import { WhatsAppQueue } from '@/lib/whatsapp-queue';
import { TemplateEngine } from '@/lib/templates';
import { createCalendarEvent } from '@/lib/googleCalendar';
import { KMS } from '@/lib/kms';
import { GhostDefender } from '@/lib/ghost-defender';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Webhooks must use Admin Client to bypass RLS since Meta doesn't send a Bearer token
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy'
);

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
    const rawBody = await req.text();
    
    // Webhook Spoofing Protection (X-Hub-Signature-256) via Zero Trust KMS
    const signature = req.headers.get('x-hub-signature-256');
    const appSecret = await KMS.getSecret('META_APP_SECRET').catch(() => process.env.META_APP_SECRET);
    
    const ip = req.headers.get('x-forwarded-for') || 'Unknown IP';
    
    if (!signature) {
      return GhostDefender.triggerTrap(ip, 'WEBHOOK_SPOOFING_ATTEMPT', 'Missing X-Hub-Signature-256');
    }

    if (appSecret) {
      const expectedSignature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      if (signature !== expectedSignature) {
        // GHOST DEFENDER: Trap Triggered (Webhook Spoofing Attempt)
        return GhostDefender.triggerTrap(ip, 'WEBHOOK_SPOOFING_ATTEMPT', 'Invalid X-Hub-Signature-256');
      }
    } else {
      console.error('CRITICAL: META_APP_SECRET missing in KMS. Blocking webhooks to prevent spoofing.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const body = JSON.parse(rawBody);

    // Check if it's a WhatsApp message
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (message) {
        const from = message.from;
        const businessPhoneNumberId = value?.metadata?.phone_number_id;

        // Find Tenant early so we can reply even for audio messages
        const { data: tenant } = await supabaseAdmin
          .from('tenants')
          .select('*')
          .eq('whatsapp_number_id', businessPhoneNumberId)
          .limit(1)
          .single();

        if (message.type !== 'text') {
          if (tenant) {
            const reply = await TemplateEngine.getMessage(tenant.id, 'audio_unsupported', tenant.language || 'ar');
            await WhatsAppQueue.enqueue(from, reply, businessPhoneNumberId, tenant.meta_token, tenant.id);
          }
          return NextResponse.json({ status: 'ok' });
        }

        let text = message.text.body;

        // 10000-YEAR HACKER DEFENSE: Text Payload Truncation (Prevent AI Token Drain)
        // WhatsApp allows up to 65,536 characters. A hacker could send a massive novel to drain your Gemini bill.
        if (text.length > 1500) {
          console.warn(`[SECURITY] Oversized WhatsApp message received from ${from}. Truncating.`);
          text = text.substring(0, 1500) + '... (تم قص الرسالة لتجاوزها الحد المسموح)';
        }

        if (!tenant) {
          console.warn(`[Webhook] Unrecognized business phone number ID: ${businessPhoneNumberId}`);
          return NextResponse.json({ status: 'ok' });
        }        if (tenant.status === 'suspended') {
          console.log(`[Webhook] Tenant ${tenant.name} is suspended. Skipping.`);
          return NextResponse.json({ status: 'ok' });
        }

        if (tenant.trial_ends_at) {
          const expirationDate = new Date(tenant.trial_ends_at);
          if (new Date() > expirationDate) {
            const reply = await TemplateEngine.getMessage(tenant.id, 'trial_expired', tenant.language || 'ar');
            await WhatsAppQueue.enqueue(from, reply, businessPhoneNumberId, tenant.meta_token, tenant.id);
            return NextResponse.json({ status: 'ok' });
          }
        }

        // 10000-YEAR MAFIA BOSS DEFENSE: Enforce Plan Quotas on WhatsApp
        // If we don't enforce this here, a clinic can process a million messages a month on a $50 plan.
        const { count: aiMessageCount } = await supabaseAdmin
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('sender', 'outgoing');

        const usage = aiMessageCount || 0;
        const tier = tenant.subscription_tier || 'trial';
        
        let limit = 100; // Trial limit
        if (tier === 'basic') limit = 1000;
        if (tier === 'pro') limit = 5000;

        if (usage >= limit) {
          console.warn(`[QUOTA EXCEEDED] Tenant ${tenant.name} reached limit of ${limit} messages.`);
          const reply = await TemplateEngine.getMessage(tenant.id, 'quota_exceeded', tenant.language || 'ar');
          await WhatsAppQueue.enqueue(from, reply, businessPhoneNumberId, tenant.meta_token, tenant.id);
          return NextResponse.json({ status: 'ok' });
        }

        // 1.5 Prevent Meta Webhook Retries (Deduplication)
        // If we received the exact same text from the same user in the last 3 minutes, it's a retry.
        const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        const { data: recentMessages } = await supabaseAdmin
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
        await supabaseAdmin.from('messages').insert({
          tenant_id: tenant.id,
          session_id: from,
          sender: 'incoming',
          text: text
        });

        // 3. Fetch History (last 60 messages)
        const { data: historyData } = await supabaseAdmin
          .from('messages')
          .select('sender, text')
          .eq('session_id', from)
          .order('created_at', { ascending: false })
          .limit(60);
        
        const history = (historyData || []).reverse();

        // 4. Process with AI
        const aiResponse = await processIncomingMessage(text, tenant.id, history, from);

        // 4. Send Message back to WhatsApp FIRST so the user doesn't wait
        console.log(`Enqueuing to ${from}: ${aiResponse.replyMessage}`);
        await WhatsAppQueue.enqueue(from, aiResponse.replyMessage, businessPhoneNumberId, tenant.meta_token, tenant.id);

        // 5. Save AI outgoing message
        const insertRes = await supabaseAdmin.from('messages').insert({
          tenant_id: tenant.id,
          session_id: from,
          sender: 'outgoing',
          text: aiResponse.replyMessage || 'Fallback text'
        });
        if (insertRes.error) {
          throw new Error('Insert Error: ' + JSON.stringify(insertRes.error));
        }

        // 6. If Booking or Order detected, insert into DB
        if ((aiResponse.intent === 'book' || aiResponse.intent === 'order') && aiResponse.bookings && aiResponse.bookings.length > 0) {
          for (const bookingData of (aiResponse.bookings || [])) {
            if (!bookingData.bookingTime) continue;

            // Prevent duplicates (webhook retry issue)
            const { data: existingBooking } = await supabaseAdmin
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

            let finalServiceName = bookingData.serviceName || 'خدمة عامة';
            if (bookingData.address) {
              finalServiceName += ` (التوصيل إلى: ${bookingData.address})`;
            }

            let teamMemberId = null;
            if (bookingData.providerName) {
              const { data: members } = await supabaseAdmin
                .from('team_members')
                .select('id')
                .eq('tenant_id', tenant.id)
                .ilike('name', `%${bookingData.providerName}%`)
                .limit(1);
              teamMemberId = members?.[0]?.id || null;
            }

            const { data: newBooking, error: insertError } = await supabaseAdmin.from('bookings').insert({
              tenant_id: tenant.id,
              customer_name: bookingData.customerName || 'عميل واتساب',
              customer_phone: from,
              booking_time: bookingData.bookingTime || new Date().toISOString(), // Fallback to now for immediate delivery orders
              service_name: finalServiceName,
              team_member_id: teamMemberId,
              source: 'whatsapp'
            }).select().single();

            // Handle Concurrency (Double Booking Lock)
            if (insertError) {
              if (insertError.code === '23505') { // Postgres Unique Violation
                console.warn(`[Concurrency] Double booking prevented for ${bookingData.bookingTime}`);
                const reply = await TemplateEngine.getMessage(tenant.id, 'double_booking', tenant.language || 'ar');
                await WhatsAppQueue.enqueue(from, reply, businessPhoneNumberId, tenant.meta_token, tenant.id);
                continue;
              }
              console.error('Booking Insert Error:', insertError);
              continue;
            }

            // Fire Zapier / Custom Webhook if configured (SSRF Protection Enabled)
            if (newBooking && tenant.zapier_webhook) {
              const hookUrl = tenant.zapier_webhook;
              // SSRF Defense: Only allow Zapier and Make domains
              if (hookUrl.startsWith('https://hooks.zapier.com/') || hookUrl.startsWith('https://hook.make.com/')) {
                try {
                  await fetch(hookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      event: 'new_booking',
                      tenant: tenant.name,
                      ...newBooking
                    })
                  });
                  console.log(`[Webhook] Fired Zapier integration for ${tenant.name}`);
                } catch (err) {
                  console.error('[Webhook] Failed to fire Zapier integration:', err);
                }
              } else {
                console.warn(`[SECURITY ALERT] SSRF Blocked. Disallowed Webhook URL: ${hookUrl}`);
              }
            }

            // Sync with Google Calendar if connected
            const { data: teamMembers } = await supabaseAdmin
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
                
                const branchTag = bookingData.branchName ? `[${bookingData.branchName}] ` : '';
                const calResponse = await createCalendarEvent(refreshToken, {
                  summary: `${branchTag}حجز: ${bookingData.customerName || 'عميل واتساب'}`,
                  description: `الخدمة: ${bookingData.serviceName || 'كشف'}\nرقم التليفون: ${from}\nتم الحجز تلقائياً عبر الذكاء الاصطناعي على الواتساب.`,
                  startTime: startDate.toISOString(),
                  endTime: endDate.toISOString(),
                });
                
                if (calResponse.id) {
                  await supabaseAdmin.from('bookings').update({ google_event_id: calResponse.id }).eq('id', newBooking.id);
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
          const { data: bookingsToCancel } = await supabaseAdmin
            .from('bookings')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('customer_phone', from)
            .gte('booking_time', new Date().toISOString());

          if (bookingsToCancel && bookingsToCancel.length > 0) {
            for (const booking of bookingsToCancel) {
              // Delete from Google Calendar if it has an event ID
              if (booking.google_event_id) {
                const { data: teamMembers } = await supabaseAdmin
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
              await supabaseAdmin.from('bookings').delete().eq('id', booking.id);
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


