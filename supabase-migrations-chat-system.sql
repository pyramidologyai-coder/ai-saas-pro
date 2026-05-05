-- ========================================================
-- OMNICHANNEL CHAT SYSTEM MIGRATION
-- Creates conversations and chat_messages tables
-- ========================================================

-- 1. جدول المحادثات (Conversations)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL, -- whatsapp, messenger, instagram
    customer_name VARCHAR(255) NOT NULL,
    customer_phone_or_id VARCHAR(255) NOT NULL,
    is_ai_paused BOOLEAN DEFAULT false,
    last_message_text TEXT,
    last_message_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, channel, customer_phone_or_id)
);

-- جدار حماية المحادثات
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conversations_owner_access" ON public.conversations;
CREATE POLICY "conversations_owner_access" ON public.conversations FOR ALL 
USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()))
WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

-- 2. جدول الرسائل (Messages)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    sender_type VARCHAR(50) NOT NULL, -- customer, ai, human_agent
    message_text TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدار حماية الرسائل
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_owner_access" ON public.chat_messages;
CREATE POLICY "messages_owner_access" ON public.chat_messages FOR ALL 
USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()))
WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));
