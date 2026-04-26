import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: messages } = await supabase.from('messages').select('text, sender, created_at').order('created_at', { ascending: false }).limit(2);
  
  return NextResponse.json({
    bookingsCount: bookings?.length || 0,
    bookings: bookings,
    messagesCount: messages?.length || 0,
    messages: messages
  });
}
