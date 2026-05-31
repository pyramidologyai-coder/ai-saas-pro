import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { MessagesUI } from '@/components/master-admin/MessagesUI';

export const dynamic = 'force-dynamic';

async function withTimeout<T>(promise: Promise<T>, ms = 10000): Promise<Awaited<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('timeout')), ms);
      })
    ]);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    throw error;
  }
}

export default async function MasterAdminMessagesPage() {
  const supabase = await createClient();

  let redirectTarget: string | null = null;
  let analyticsData: any = null;
  let conversationsData: any[] = [];
  let chatMessagesData: any[] = [];
  let agencies: any[] = [];
  let tenants: any[] = [];

  try {
    const [
      userRes,
      isMasterRes,
      analyticsRes,
      conversationsRes,
      chatMessagesRes,
      agenciesRes,
      tenantsRes
    ] = await Promise.allSettled([
      withTimeout(supabase.auth.getUser()),
      withTimeout(Promise.resolve(supabase.rpc('verify_master_admin_role'))),
      withTimeout(Promise.resolve(supabase.rpc('get_channel_analytics', { p_days: 30 }))),
      withTimeout(Promise.resolve(
        supabase
          .from('conversations')
          .select(`
            id,
            channel,
            customer_name,
            last_message_time,
            tenant_id,
            tenants ( name, agency_id, agencies ( name ) )
          `)
          .order('last_message_time', { ascending: false })
          .limit(100)
      )),
      withTimeout(Promise.resolve(
        supabase
          .from('chat_messages')
          .select('id, conversation_id')
      )),
      withTimeout(Promise.resolve(supabase.from('agencies').select('id, name'))),
      withTimeout(Promise.resolve(supabase.from('tenants').select('id, name, agency_id')))
    ]);

    const user = userRes.status === 'fulfilled' && userRes.value.data ? userRes.value.data.user : null;
    const isMaster = isMasterRes.status === 'fulfilled' ? isMasterRes.value.data : false;

    if (!user) {
      redirectTarget = '/auth';
    } else if (!isMaster) {
      redirectTarget = '/admin';
    } else {
      // Parse Analytics
      if (analyticsRes.status === 'fulfilled' && (analyticsRes.value as any).data) {
        analyticsData = (analyticsRes.value as any).data;
      }

      // Parse Conversations
      if (conversationsRes.status === 'fulfilled' && (conversationsRes.value as any).data) {
        conversationsData = (conversationsRes.value as any).data;
      }

      // Parse Chat Messages
      if (chatMessagesRes.status === 'fulfilled' && (chatMessagesRes.value as any).data) {
        chatMessagesData = (chatMessagesRes.value as any).data;
      }

      // Parse Agencies
      if (agenciesRes.status === 'fulfilled' && (agenciesRes.value as any).data) {
        agencies = (agenciesRes.value as any).data;
      }

      // Parse Tenants
      if (tenantsRes.status === 'fulfilled' && (tenantsRes.value as any).data) {
        tenants = (tenantsRes.value as any).data;
      }
    }
  } catch (e) {
    console.error('Error in MasterAdminMessagesPage:', e);
    if (!redirectTarget) redirectTarget = '/admin';
  }

  if (redirectTarget) {
    redirect(redirectTarget);
  }

  // UUID Validation & Sanitization
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const sanitizedAgencies = agencies.filter((a: any) => a.id && UUID_REGEX.test(a.id));
  const sanitizedTenants = tenants.filter((t: any) => t.id && UUID_REGEX.test(t.id));

  // Compute Message Counts map
  const messageCountsMap: Record<string, number> = {};
  if (chatMessagesData) {
    chatMessagesData.forEach((msg: any) => {
      if (msg.conversation_id) {
        messageCountsMap[msg.conversation_id] = (messageCountsMap[msg.conversation_id] || 0) + 1;
      }
    });
  }

  const sanitizedConversations = conversationsData
    .filter((c: any) => c.id && UUID_REGEX.test(c.id))
    .map((c: any) => {
      const tenantName = c.tenants?.name || 'مستأجر غير معروف';
      const agencyId = c.tenants?.agency_id || null;
      const agencyName = c.tenants?.agencies?.name || 'بدون وكالة';
      const count = messageCountsMap[c.id] || 0;

      return {
        id: c.id,
        tenant_id: c.tenant_id,
        channel: c.channel || 'whatsapp',
        customer_name: c.customer_name || 'عميل غير معروف',
        last_message_time: c.last_message_time,
        tenant_name: tenantName,
        agency_id: agencyId,
        agency_name: agencyName,
        message_count: count
      };
    });

  return (
    <MessagesUI
      initialAnalytics={analyticsData}
      initialConversations={sanitizedConversations}
      agencies={sanitizedAgencies}
      tenants={sanitizedTenants}
    />
  );
}
