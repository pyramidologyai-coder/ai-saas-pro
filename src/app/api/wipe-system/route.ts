import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Delete all bookings
    const { error: error1 } = await supabase.from('bookings').delete().not('id', 'is', null);
    // Delete all messages
    const { error: error2 } = await supabase.from('messages').delete().not('id', 'is', null);
    
    if (error1 || error2) throw error1 || error2;
    
    return new NextResponse(`
      <div dir="rtl" style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f0fdf4; color: #166534; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <h1 style="font-size: 3rem; margin-bottom: 20px;">✅ تم تصفير السيستم بالكامل!</h1>
        <p style="font-size: 1.5rem;">تم مسح جميع الحجوزات وجميع المحادثات من الذاكرة.</p>
        <p style="font-size: 1.2rem; color: #4b5563; margin-top: 20px;">السيستم الآن أبيض تماماً، يمكنك التجربة من الصفر.</p>
      </div>
    `, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('Failed to clear system:', error);
    return NextResponse.json({ error: 'Failed to clear system' }, { status: 500 });
  }
}
