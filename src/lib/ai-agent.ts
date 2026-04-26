import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './supabase';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyBwb26YF603BDmGLK7M0Wyq3Ka-OzASp4s');

export interface AIResponse {
  intent: 'book' | 'inquire' | 'chat' | 'cancel';
  replyMessage: string;
  bookings?: {
    customerName?: string;
    serviceName?: string;
    bookingTime?: string;
  }[];
}

/**
 * Advanced Generic AI Processing for Multi-tenant SaaS
 */
export const processIncomingMessage = async (message: string, tenantId: string, history: any[] = [], customerPhone?: string): Promise<AIResponse> => {
  try {
    // 1. Fetch Tenant Info
    const { data: tenant } = await supabase.from('tenants').select('*').eq('id', tenantId).single();
    if (!tenant) throw new Error('Tenant not found');

    // 2. Fetch Services/Menu Items
    const { data: items } = await supabase.from('items').select('*').eq('tenant_id', tenantId);
    const itemsInfo = items?.map(i => `${i.name} (${i.price} ج.م)`).join(', ');

    // 2.5 Fetch Upcoming Bookings for this customer
    let upcomingBookingsText = 'هذا العميل (ليس لديه) أي حجوزات مسجلة حالياً في النظام.';
    if (customerPhone) {
      const { data: userBookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('customer_phone', customerPhone)
        .gte('booking_time', new Date().toISOString())
        .order('booking_time', { ascending: true });

      if (userBookings && userBookings.length > 0) {
        const bookingsList = userBookings.map(b => `${b.customer_name} - ${b.service_name} (يوم ${new Date(b.booking_time).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })})`).join('، ');
        upcomingBookingsText = `هذا العميل لديه الحجوزات التالية مسجلة في النظام باسمه: [${bookingsList}].`;
      }
    }
    
    console.log('--- DEBUG: upcomingBookingsText ---');
    console.log(upcomingBookingsText);
    console.log('------------------------------------');

    // 3. Prepare Dynamic System Prompt
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const businessContext = tenant.type === 'clinic' 
      ? `أنت موظف استقبال ذكي في عيادة "${tenant.name}".`
      : `أنت مساعد ذكي في مطعم "${tenant.name}".`;

    const workingHours = tenant.working_hours || 'من السبت للخميس، من 2 ظهراً لـ 10 مساءً';
    const customPrompt = tenant.custom_prompt ? `تعليمات إضافية من الإدارة: ${tenant.custom_prompt}` : '';

    const today = new Date();
    const next7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dayName = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', timeZone: 'Africa/Cairo' }).format(d);
      const dateStr = d.toISOString().split('T')[0];
      return `${dayName} (${dateStr})`;
    }).join('، ');

    const systemInstruction = `
      ${businessContext} 
      هدفلك مساعدة العملاء بلهجة مصرية ودودة جداً وبدون تكلف.
      تحذير هام جداً: لا تستخدم أي عبارات ترحيب (مثل أهلاً بك، إزيك، نورتنا، إلخ) نهائياً. ادخل في صلب الموضوع ومباشرة في الرد على رسالة العميل.
      اليوم هو: ${new Intl.DateTimeFormat('ar-EG', { weekday: 'long', timeZone: 'Africa/Cairo' }).format(today)}.
      الوقت الحالي: ${today.toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo' })}.
      دليل تواريخ الأيام الـ 7 القادمة (استخدمه حصراً لمعرفة التواريخ): ${next7Days}.
      مواعيد العمل: ${workingHours}.
      الخدمات المتاحة وأسعارها: [${itemsInfo}].
      
      حالة الحجوزات المؤكدة للعميل: ${upcomingBookingsText}
      ملاحظة هامة جداً: لا تخبر العميل بحالة حجوزاته (سواء عنده حجوزات أو لا) **إلا إذا سأل هو بنفسه عنها**. إذا كان العميل يطلب حجزاً جديداً، ركز فقط على إتمام الحجز الجديد وتجاهل ذكر الحجوزات القديمة تماماً. استخدم حالة الحجوزات السابقة لمعلوماتك فقط.
      ${customPrompt}

      يجب أن يكون ردك بتنسيق JSON حصراً كالتالي:
      {
        "reply": "نص الرد بالعامية المصرية",
        "intent": "book" أو "chat" أو "inquire" أو "cancel",
        "bookings": [
          {
            "customerName": "اسم العميل لو ذكره",
            "serviceName": "اسم الخدمة المطلوبة",
            "bookingTime": "يجب أن يكون بصيغة ISO 8601 مع إضافة فرق التوقيت لمصر +03:00 دائماً (مثال: 2026-04-27T17:00:00+03:00). لا تستخدم حرف Z أبداً."
          }
        ]
      }
      
      تحذيرات هامة جداً (التزم بها حرفياً):
      1. مصفوفة "bookings" في الـ JSON: (يجب أن تكون فارغة تماماً []) إلا في حالة واحدة فقط: إذا كان العميل (يطلب حجزاً جديداً الآن). إياك أن تضع الحجوزات القديمة أو الحالية في هذه المصفوفة أبداً، لأن وضعها سيجعل النظام يكرر حجزها مرة أخرى!
      2. لا تقم بتأليف أو تخمين أو توزيع مواعيد من تلقاء نفسك أبداً.
      3. إذا كانت بيانات الحجز غير مكتملة، اسأل العميل عن الناقص.
      4. إذا سأل العميل "هل لي حجوزات؟"، اجعل intent = "inquire" واترك مصفوفة bookings فارغة تماماً [].
      5. إذا طلب العميل إلغاء حجزه، اجعل intent = "cancel" ورد بأسلوب لبق.
    `;

    // 4. Format history for Gemini
    const formattedHistory = history.map(h => ({
      role: h.sender === 'incoming' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));

    // Add system instruction as the first message or context
    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: "System Instructions: " + systemInstruction }] },
        { role: 'model', parts: [{ text: "مفهوم، سألتزم بالتعليمات وتنسيق JSON." }] },
        ...formattedHistory
      ]
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();
    const cleanText = responseText.replace(/```json\n/g, '').replace(/```/g, '').trim();
    const responseJson = JSON.parse(cleanText);

    return {
      intent: responseJson.intent || 'chat',
      replyMessage: responseJson.reply || responseJson.replyMessage || responseJson.text || 'عذراً، لم أتمكن من فهم رسالتك بوضوح.',
      bookings: responseJson.bookings || (responseJson.bookingDetails ? [responseJson.bookingDetails] : [])
    };
  } catch (error) {
    console.error('Gemini/DB Error:', error);
    return {
      intent: 'chat',
      replyMessage: 'أهلاً بك يا فندم! معلش حصل ضغط بسيط عندي، ممكن حضرتك تكرر رسالتك؟'
    };
  }
};
