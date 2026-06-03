import type { SupabaseClient } from '@supabase/supabase-js';

export interface BookingData {
  tenant_id: string;
  customer_name: string;
  customer_phone?: string;
  booking_time: string;
  service_name: string;
  provider_name?: string;
  source: 'whatsapp' | 'instagram' | 'facebook' | 'web';
}

export const createBooking = async (data: BookingData, db: SupabaseClient) => {
  try {
    // 1. Find the service ID from the name (fuzzy match or simple search)
    const { data: services } = await db
      .from('items')
      .select('id')
      .eq('tenant_id', data.tenant_id)
      .ilike('name', `%${data.service_name}%`)
      .limit(1);

    const serviceId = services?.[0]?.id;

    // 2. Find the team member ID from the provider name
    let teamMemberId = null;
    if (data.provider_name) {
      const { data: members } = await db
        .from('team_members')
        .select('id')
        .eq('tenant_id', data.tenant_id)
        .ilike('name', `%${data.provider_name}%`)
        .limit(1);
      
      teamMemberId = members?.[0]?.id || null;
    }

    // 3. Insert the booking
    const { data: booking, error } = await db
      .from('bookings')
      .insert({
        tenant_id: data.tenant_id,
        item_id: serviceId,
        team_member_id: teamMemberId,
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
