import { NextResponse } from 'next/server';
import { processIncomingMessage } from '@/lib/ai-agent';
import { createBooking } from '@/lib/bookings';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, tenantId, history } = body;

    const response = await processIncomingMessage(
      message, 
      tenantId || '13814bff-a653-439a-8891-2c5a81124eb8',
      history || []
    );

    // If a booking is detected, record it in the DB
    if (response.intent === 'book' && response.bookingDetails?.bookingTime) {
      await createBooking({
        tenant_id: tenantId || '13814bff-a653-439a-8891-2c5a81124eb8',
        customer_name: response.bookingDetails.customerName || 'عميل تجريبي',
        booking_time: response.bookingDetails.bookingTime,
        service_name: response.bookingDetails.serviceName || 'كشف',
        source: 'web'
      });
    }

    return NextResponse.json({ replyMessage: response.replyMessage });

  } catch (error: any) {
    console.error('SYSTEM ERROR:', error);
    return NextResponse.json({ replyMessage: "يا فندم السيستم معلق شوية، حابب تحجز إيه؟" });
  }
}
