import { supabase } from './supabase';

export interface BookingData {
  tenant_id: string;
  customer_name: string;
  customer_phone?: string;
  booking_time: string;
  service_name: string;
  source: 'whatsapp' | 'instagram' | 'facebook' | 'web';
}

export const createBooking = async (data: BookingData) => {
  try {
    // 1. Find the service ID from the name (fuzzy match or simple search)
    const { data: services } = await supabase
      .from('items')
      .select('id')
      .eq('tenant_id', data.tenant_id)
      .ilike('name', `%${data.service_name}%`)
      .limit(1);

    const serviceId = services?.[0]?.id;

    // 2. Insert the booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        tenant_id: data.tenant_id,
        item_id: serviceId,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        booking_time: data.booking_time,
        source: data.source,
        status: 'pending',
        ai_handled: true
      })
      .select()
      .single();

    if (error) throw error;
    return booking;
  } catch (error) {
    console.error('Error creating booking:', error);
    return null;
  }
};
