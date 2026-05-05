-- 1. إنشاء جدول قوالب الواتساب
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  language VARCHAR(10) DEFAULT 'ar',
  intent VARCHAR(50) NOT NULL, -- نوع الرسالة: ترحيب، تأكيد حجز، الخ
  template_text TEXT NOT NULL, -- نص الرسالة نفسه
  UNIQUE(tenant_id, language, intent) -- لمنع تكرار نفس القالب لنفس النشاط
);

-- 2. تفعيل جدار الحماية (RLS)
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- 3. سياسة الأمان: لا يرى القوالب ولا يعدلها سوى صاحب النشاط أو الوكالة التابع لها
DROP POLICY IF EXISTS template_owner_access ON public.whatsapp_templates;
CREATE POLICY template_owner_access ON public.whatsapp_templates 
FOR ALL 
USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid() OR agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid())))
WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid() OR agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid())));
