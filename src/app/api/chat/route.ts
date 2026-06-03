export const maxDuration = 60;
import { NextResponse } from 'next/server';
import { processIncomingMessage } from '@/lib/ai-agent';
import { createBooking } from '@/lib/bookings';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

// 1000-Year Hacker Defense: In-memory rate limiter (protects against Script Kiddies & DoW)
const rateLimitMap = new Map<string, { count: number, resetTime: number }>();

const normalizeHost = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return value.split('/')[0]?.split(':')[0]?.toLowerCase() || null;
  }
};

const isLocalHost = (host: string | null) =>
  host === 'localhost' || host === '127.0.0.1' || host === '::1';

export async function POST(req: Request) {
  try {
    // 1. IP Rate Limiting (Denial of Wallet Protection)
    const ip = req.headers.get('x-forwarded-for') || 'unknown_ip';
    const now = Date.now();
    const limitData = rateLimitMap.get(ip);
    
    if (limitData && limitData.resetTime > now) {
      if (limitData.count > 15) { // Strict Limit: 15 messages per minute per IP
        return NextResponse.json({ replyMessage: 'عذراً، لقد تجاوزت الحد المسموح من الرسائل في الدقيقة. يرجى الانتظار قليلاً.' }, { status: 429 });
      }
      limitData.count++;
    } else {
      rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 }); // 60 seconds window
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const body = await req.json();
    let { message, tenantId, history, domain } = body;

    if (!tenantId || tenantId === '13814bff-a653-439a-8891-2c5a81124eb8') {
      return NextResponse.json({ error: 'Valid Tenant ID is required' }, { status: 400 });
    }

    // SECURITY: Input Length Validation (Prevent OOM & Token Drain Attacks)
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
    }
    if (message.length > 1000) {
      console.warn(`[SECURITY] Payload too large from IP: ${ip}. Truncating.`);
      message = message.substring(0, 1000);
    }
    
    // SECURITY: Limit history size
    if (Array.isArray(history) && history.length > 20) {
      history = history.slice(-20); // Only keep the last 20 messages
    }

    // 2. Tenant Status & Quota Validation
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('id, status, subscription_tier, custom_domain')
      .eq('id', tenantId)
      .single();

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    if (tenant.status === 'suspended') {
      return NextResponse.json({ replyMessage: 'عذراً يا فندم، يتم الآن الصيانة الدورية للنظام. برجاء التواصل معنا هاتفياً أو ترك رسالتك.' }, { status: 403 });
    }

    const requestHost = normalizeHost(req.headers.get('origin') || req.headers.get('referer'));
    const submittedDomain = normalizeHost(domain);
    const tenantDomain = normalizeHost(tenant.custom_domain);
    const domainMatches = Boolean(tenantDomain && (requestHost === tenantDomain || submittedDomain === tenantDomain));
    const localDevBypass = process.env.NODE_ENV !== 'production' && isLocalHost(requestHost);

    if (tenantDomain && !domainMatches && !localDevBypass) {
      return NextResponse.json({ error: 'Forbidden: Invalid tenant domain.' }, { status: 403 });
    }

    // 1000-Year Hacker Defense: Enforce Plan Quotas (Prevent Infinite Cost Drain)
    const { count: aiMessageCount, error: countError } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('sender', 'outgoing');

    const usage = aiMessageCount || 0;
    const tier = tenant.subscription_tier || 'trial';
    
    let limit = 100; // Trial limit
    if (tier === 'basic') limit = 1000;
    if (tier === 'pro') limit = 5000;

    if (usage >= limit) {
      return NextResponse.json({ replyMessage: 'عذراً يا فندم، يتم الآن تحويل محادثتك لموظف الاستقبال (بسبب ضغط الرسائل). برجاء ترك استفسارك وسنقوم بالرد عليك في أقرب وقت ممكن.' }, { status: 403 });
    }

    // 3. Process the AI response
    const response = await processIncomingMessage(
      message, 
      tenantId,
      history || [],
      undefined,
      supabaseAdmin
    );

    // 4. Record Bookings securely
    if (response.intent === 'book' && response.bookings && response.bookings.length > 0 && response.bookings[0].bookingTime) {
      await createBooking({
        tenant_id: tenantId,
        customer_name: response.bookings[0].customerName || 'عميل (ويب شات)',
        booking_time: response.bookings[0].bookingTime,
        service_name: response.bookings[0].serviceName || 'استشارة',
        source: 'web'
      }, supabaseAdmin);
    }

    return NextResponse.json({ replyMessage: response.replyMessage });

  } catch (error: any) {
    console.error('[SECURITY/SYSTEM ERROR]:', error);
    return NextResponse.json({ replyMessage: "يا فندم السيستم معلق شوية، حابب تحجز إيه؟" }, { status: 500 });
  }
}
