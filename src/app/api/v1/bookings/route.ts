import { NextResponse } from 'next/server';

import {
  authenticateExternalApiRequest,
  type ExternalApiAuthResult,
} from '@/lib/external-api-auth';
import { TenantRateLimiter } from '@/lib/rate-limiter';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

type BookingRow = {
  id: string;
  customer_name: string;
  service_name: string;
  booking_time: string;
  branch: string | null;
  status: string;
  phone_number: string | null;
  created_at: string;
};

type BookingRequestBody = {
  customerName: string;
  serviceName: string;
  bookingTime: string;
  phoneNumber: string | null;
  branch: string;
};

const MAX_CUSTOMER_NAME_LENGTH = 120;
const MAX_SERVICE_NAME_LENGTH = 160;
const MAX_BOOKING_TIME_LENGTH = 80;
const MAX_PHONE_NUMBER_LENGTH = 40;
const MAX_BRANCH_LENGTH = 120;

function unauthorizedResponse(auth: Extract<ExternalApiAuthResult, { ok: false }>) {
  if (auth.status === 401) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
}

function toBookingDto(booking: BookingRow) {
  return {
    id: booking.id,
    customerName: booking.customer_name,
    serviceName: booking.service_name,
    bookingTime: booking.booking_time,
    branch: booking.branch,
    status: booking.status,
    phoneNumber: booking.phone_number,
    createdAt: booking.created_at,
  };
}

async function readJsonBody(req: Request) {
  try {
    return { ok: true as const, body: await req.json() };
  } catch {
    return { ok: false as const, error: 'Invalid JSON body.' };
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRequiredString(
  body: Record<string, unknown>,
  field: string,
  maxLength: number
) {
  const value = body[field];
  if (typeof value !== 'string') {
    return { ok: false as const, error: `${field} must be a string.` };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false as const, error: `${field} is required.` };
  }

  if (trimmed.length > maxLength) {
    return { ok: false as const, error: `${field} is too long.` };
  }

  return { ok: true as const, value: trimmed };
}

function readOptionalString(
  body: Record<string, unknown>,
  field: string,
  maxLength: number
) {
  const value = body[field];
  if (value === undefined || value === null) {
    return { ok: true as const, value: null };
  }

  if (typeof value !== 'string') {
    return { ok: false as const, error: `${field} must be a string.` };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true as const, value: null };
  }

  if (trimmed.length > maxLength) {
    return { ok: false as const, error: `${field} is too long.` };
  }

  return { ok: true as const, value: trimmed };
}

function validateBookingBody(body: unknown) {
  if (!isPlainObject(body)) {
    return { ok: false as const, error: 'Body must be a JSON object.' };
  }

  const customerName = readRequiredString(body, 'customerName', MAX_CUSTOMER_NAME_LENGTH);
  if (!customerName.ok) return customerName;

  const serviceName = readRequiredString(body, 'serviceName', MAX_SERVICE_NAME_LENGTH);
  if (!serviceName.ok) return serviceName;

  const bookingTime = readRequiredString(body, 'bookingTime', MAX_BOOKING_TIME_LENGTH);
  if (!bookingTime.ok) return bookingTime;

  if (!Number.isFinite(new Date(bookingTime.value).getTime())) {
    return { ok: false as const, error: 'bookingTime must be a valid date.' };
  }

  const phoneNumber = readOptionalString(body, 'phoneNumber', MAX_PHONE_NUMBER_LENGTH);
  if (!phoneNumber.ok) return phoneNumber;

  const branch = readOptionalString(body, 'branch', MAX_BRANCH_LENGTH);
  if (!branch.ok) return branch;

  return {
    ok: true as const,
    value: {
      customerName: customerName.value,
      serviceName: serviceName.value,
      bookingTime: bookingTime.value,
      phoneNumber: phoneNumber.value,
      branch: branch.value ?? 'Main Branch',
    } satisfies BookingRequestBody,
  };
}

// POST: Create a new booking via external API integration.
export async function POST(req: Request) {
  try {
    const auth = await authenticateExternalApiRequest(req, 'bookings:create');
    if (!auth.ok) {
      return unauthorizedResponse(auth);
    }

    if (!TenantRateLimiter.check(auth.tenantId, 60, 60000)) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
    }

    const parsedBody = await readJsonBody(req);
    if (!parsedBody.ok) {
      return NextResponse.json({ error: parsedBody.error }, { status: 400 });
    }

    const validatedBody = validateBookingBody(parsedBody.body);
    if (!validatedBody.ok) {
      return NextResponse.json({ error: validatedBody.error }, { status: 400 });
    }

    const body = validatedBody.value;

    const { data: booking, error } = await getSupabaseAdminClient()
      .from('bookings')
      .insert({
        tenant_id: auth.tenantId,
        customer_name: body.customerName,
        service_name: body.serviceName,
        booking_time: body.bookingTime,
        branch: body.branch,
        status: 'pending',
        phone_number: body.phoneNumber,
      })
      .select('id, customer_name, service_name, booking_time, branch, status, phone_number, created_at')
      .single<BookingRow>();

    if (error) throw error;

    return NextResponse.json(
      {
        success: true,
        message: 'Booking created successfully.',
        booking: toBookingDto(booking),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[API v1] Error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// GET: Fetch bookings for the authenticated tenant.
export async function GET(req: Request) {
  try {
    const auth = await authenticateExternalApiRequest(req, 'bookings:read');
    if (!auth.ok) {
      return unauthorizedResponse(auth);
    }

    const { data: bookings, error } = await getSupabaseAdminClient()
      .from('bookings')
      .select('id, customer_name, service_name, booking_time, branch, status, phone_number, created_at')
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false })
      .returns<BookingRow[]>();

    if (error) throw error;

    return NextResponse.json(
      { success: true, bookings: (bookings ?? []).map(toBookingDto) },
      { status: 200 }
    );
  } catch (err) {
    console.error('[API v1] Error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
