-- ========================================================
-- BOT TEMPLATES MIGRATION
-- Renames whatsapp_templates to bot_templates to support
-- Omnichannel (WhatsApp, Messenger, Instagram).
-- ========================================================

-- 1. تغيير اسم الجدول (إذا لم يكن قد تم تغييره بالفعل)
ALTER TABLE IF EXISTS public.whatsapp_templates RENAME TO bot_templates;

-- 2. إضافة عمود المنصة
ALTER TABLE public.bot_templates ADD COLUMN IF NOT EXISTS channel VARCHAR(50) DEFAULT 'all';

-- 3. مسح السياسة القديمة وإعادة إنشائها بأمان وتفعيل الحماية
ALTER TABLE public.bot_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS template_owner_access ON public.bot_templates;

CREATE POLICY template_owner_access ON public.bot_templates FOR ALL 
USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid() OR agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid())))
WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid() OR agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid())));
