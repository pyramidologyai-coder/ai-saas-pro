import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TenantRateLimiter } from '@/lib/rate-limiter';
import { GhostDefender } from '@/lib/ghost-defender';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy'
);

// Helper to validate API Key
async function authenticate(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const apiKey = authHeader.split('Bearer ')[1];
  
  // Use supabaseAdmin because RLS blocks anonymous access to the tenants table
  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id, status, type, api_key');
    
  if (!tenants) return null;

  const crypto = require('crypto');
  
  // SECURE: Prevent Timing Attacks by using constant-time comparison
  for (const tenant of tenants) {
    if (tenant.api_key && tenant.api_key.length === apiKey.length) {
      if (crypto.timingSafeEqual(Buffer.from(tenant.api_key), Buffer.from(apiKey))) {
        return tenant;
      }
    }
  }
    
  return null;
}

// POST: Create a new booking via direct API Integration
export async function POST(req: Request) {
  try {
    const tenant = await authenticate(req);
    if (!tenant) {
      // Potentially trigger trap for invalid API key hammering
      return NextResponse.json({ error: 'Unauthorized. Invalid API Key.' }, { status: 401 });
    }
    
    if (tenant.status === 'suspended') {
      return NextResponse.json({ error: 'Account suspended.' }, { status: 403 });
    }

    if (!TenantRateLimiter.check(tenant.id, 60, 60000)) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
    }

    const body = await req.json();
    
    // Validate required fields
    if (!body.customerName || !body.bookingTime || !body.serviceName) {
      return NextResponse.json({ error: 'Missing required fields: customerName, bookingTime, serviceName' }, { status: 400 });
    }

    // Insert booking using Admin client
    const { data: booking, error } = await supabaseAdmin.from('bookings').insert({
      tenant_id: tenant.id,
      customer_name: body.customerName,
      service_name: body.serviceName,
      booking_time: body.bookingTime,
      branch: body.branch || 'الفرع الرئيسي',
      status: 'pending',
      phone_number: body.phoneNumber || null
    }).select().single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Booking created successfully.',
      booking: booking
    }, { status: 201 });

  } catch (err: any) {
    console.error('[API v1] Error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// GET: Fetch bookings for the authenticated tenant
export async function GET(req: Request) {
  try {
    const tenant = await authenticate(req);
    if (!tenant) {
      return NextResponse.json({ error: 'Unauthorized. Invalid API Key.' }, { status: 401 });
    }

    // Use Admin client to bypass RLS for API key authenticated requests
    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, bookings }, { status: 200 });
  } catch (err: any) {
    console.error('[API v1] Error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
