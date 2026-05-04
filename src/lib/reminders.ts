import { supabase } from './supabase';
import { sendWhatsAppMessage } from './whatsapp';

export async function sendReminder24h(bookingId: string, customerPhone: string, customerName: string, time: string, tenantId: string) {
  const { data: tenant } = await supabase.from('tenants').select('meta_phone_id, meta_access_token, reminder_enabled, reminder_credits').eq('id', tenantId).single();
  
  if (!tenant || !tenant.reminder_enabled || tenant.reminder_credits <= 0) return false;

  const msg = `مرحباً ${customerName}، تذكير بموعدك\nغداً الساعة ${time}\nهل ستتمكن من الحضور؟\nرد بـ نعم أو لأ`;
  
  await sendWhatsAppMessage(customerPhone, msg, tenant.meta_phone_id, tenant.meta_access_token);
  
  // Deduct credit
  await supabase.from('tenants').update({ reminder_credits: tenant.reminder_credits - 1 }).eq('id', tenantId);
  return true;
}

export async function sendAfterVisitThanks(bookingId: string, customerPhone: string, tenantId: string) {
  const { data: tenant } = await supabase.from('tenants').select('meta_phone_id, meta_access_token').eq('id', tenantId).single();
  
  if (!tenant) return false;

  const msg = `شكراً لزيارتك!\nنرجو تقييم تجربتك من 1 إلى 5 نجوم.`;
  await sendWhatsAppMessage(customerPhone, msg, tenant.meta_phone_id, tenant.meta_access_token);
  return true;
}

export async function sendNoShowMessage(bookingId: string, customerPhone: string, tenantId: string) {
  const { data: tenant } = await supabase.from('tenants').select('meta_phone_id, meta_access_token').eq('id', tenantId).single();
  
  if (!tenant) return false;

  const msg = `نأسف لغيابك،\nهل تريد حجز موعد جديد؟`;
  await sendWhatsAppMessage(customerPhone, msg, tenant.meta_phone_id, tenant.meta_access_token);
  return true;
}
