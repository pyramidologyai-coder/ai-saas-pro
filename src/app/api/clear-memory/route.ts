import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { error } = await supabase.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    
    return new NextResponse(`
      <div dir="rtl" style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f0fdf4; color: #166534; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <h1 style="font-size: 3rem; margin-bottom: 20px;">✅ تم مسح الذاكرة بنجاح!</h1>
        <p style="font-size: 1.5rem;">الذكاء الاصطناعي دلوقتي نسي كل الشات القديم.</p>
        <p style="font-size: 1.2rem; color: #4b5563; margin-top: 20px;">تقدر ترجع الواتساب دلوقتي وتجرب كأنك عميل جديد تماماً.</p>
      </div>
    `, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('Failed to clear memory:', error);
    return NextResponse.json({ error: 'Failed to clear memory' }, { status: 500 });
  }
}
