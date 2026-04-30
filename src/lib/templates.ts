import { createClient } from '@supabase/supabase-js';

/**
 * 2126 Cyber Security: Multilingual Template Engine
 * Fetches dynamic, language-specific templates for system messages.
 */
export class TemplateEngine {
    private static supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
        process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy'
    );

    // Fallback templates to guarantee the system never crashes if DB fails
    private static fallbacks: Record<string, Record<string, string>> = {
        'ar': {
            'quota_exceeded': 'عذراً يا فندم، يتم الآن تحويل محادثتك لموظف الاستقبال (بسبب ضغط الرسائل). برجاء ترك استفسارك وسنقوم بالرد عليك.',
            'trial_expired': 'عذراً، هذه الخدمة غير متاحة مؤقتاً لتوقف الاشتراك. يرجى الاتصال بنا هاتفياً للحجز.',
            'audio_unsupported': 'عفواً، لا يمكنني الاستماع إلى الرسائل الصوتية أو قراءة الصور حالياً. يرجى كتابة رسالتك نصياً وسأكون سعيداً بمساعدتك.',
            'double_booking': 'عذراً، يبدو أن هذا الموعد تم حجزه للتو من شخص آخر في نفس اللحظة! هل تفضل اختيار موعد آخر؟'
        },
        'en': {
            'quota_exceeded': 'Sorry, due to high message volume, you are being transferred to a human receptionist. Please leave your inquiry.',
            'trial_expired': 'Sorry, this automated service is temporarily suspended. Please call us to book an appointment.',
            'audio_unsupported': 'Sorry, I cannot process audio or image messages at the moment. Please send a text message.',
            'double_booking': 'Sorry, this time slot was just booked by someone else! Would you like to choose another time?'
        }
    };

    /**
     * Gets a template for a specific intent and language.
     * Hits Redis cache first in a full production system, fallback to DB.
     */
    static async getMessage(tenantId: string, intent: string, defaultLang: string = 'ar'): Promise<string> {
        try {
            const { data } = await this.supabaseAdmin
                .from('whatsapp_templates')
                .select('template_text')
                .eq('tenant_id', tenantId)
                .eq('language', defaultLang)
                .eq('intent', intent)
                .single();

            if (data?.template_text) {
                return data.template_text;
            }
        } catch (e) {
            console.error(`[TEMPLATE_ERROR] Failed to fetch custom template for ${intent}`);
        }

        // Use fallback if custom template isn't defined or DB fails
        const langFallbacks = this.fallbacks[defaultLang] || this.fallbacks['ar'];
        return langFallbacks[intent] || 'عذراً، النظام مشغول حالياً.';
    }
}
