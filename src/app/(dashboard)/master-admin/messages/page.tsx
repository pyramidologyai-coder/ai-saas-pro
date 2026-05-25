import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { MessagesUI } from '@/components/master-admin/MessagesUI';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';

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
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient(
    { cookies: () => cookieStore as any },
    { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_ANON_KEY }
  );

  let redirectTarget: string | null = null;
  let chatMessagesData: any[] = [];
  let conversationsData: any[] = [];
  let totalMessagesToday = 0;
  let activeConversationsCount = 0;
  let agencies: any[] = [];
  let tenants: any[] = [];

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayISO = startOfToday.toISOString();

  try {
    const [
      userRes,
      isMasterRes,
      messagesRes,
      conversationsRes,
      agenciesRes,
      tenantsRes
    ] = await Promise.allSettled([
      withTimeout(supabase.auth.getUser()),
      withTimeout(Promise.resolve(supabase.rpc('verify_master_admin_role'))),
      
      withTimeout(Promise.resolve(
        supabase
          .from('chat_messages')
          .select(`
            id,
            tenant_id,
            channel,
            sender,
            created_at,
            tenants ( name, agency_id, agencies ( name ) )
          `)
          .order('created_at', { ascending: false })
          .limit(100)
      )),

      withTimeout(Promise.resolve(
        supabase
          .from('conversations')
          .select(`
            id,
            channel,
            customer_name,
            is_ai_paused,
            last_message_time,
            tenant_id,
            tenants ( name, agency_id, agencies ( name ) )
          `)
          .order('last_message_time', { ascending: false })
          .limit(50)
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
      // Parse Chat Messages
      if (messagesRes.status === 'fulfilled' && messagesRes.value.data) {
        chatMessagesData = messagesRes.value.data;
      }

      // Parse Conversations
      if (conversationsRes.status === 'fulfilled' && conversationsRes.value.data) {
        conversationsData = conversationsRes.value.data;
        activeConversationsCount = conversationsData.length;
      }

      // Calculate Total Messages Today from fetched chat_messages or database count
      const todayMsgsCountRes = await withTimeout(
        Promise.resolve(
          supabase
            .from('chat_messages')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', startOfTodayISO)
        )
      ).catch(() => ({ count: null }));

      if (todayMsgsCountRes.count !== null) {
        totalMessagesToday = todayMsgsCountRes.count;
      } else {
        totalMessagesToday = chatMessagesData.filter(m => new Date(m.created_at) >= startOfToday).length;
      }

      // Parse Agencies
      if (agenciesRes.status === 'fulfilled' && agenciesRes.value.data) {
        agencies = agenciesRes.value.data;
      }

      // Parse Tenants
      if (tenantsRes.status === 'fulfilled' && tenantsRes.value.data) {
        tenants = tenantsRes.value.data;
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

  const sanitizedMessages = chatMessagesData
    .filter((m: any) => m.id && UUID_REGEX.test(m.id))
    .map((m: any) => {
      const tenantName = m.tenants?.name || 'مستأجر غير معروف';
      const agencyId = m.tenants?.agency_id || null;
      const agencyName = m.tenants?.agencies?.name || 'بدون وكالة';

      return {
        id: m.id,
        tenant_id: m.tenant_id,
        channel: m.channel || 'whatsapp',
        sender: m.sender || 'incoming',
        created_at: m.created_at,
        tenant_name: tenantName,
        agency_id: agencyId,
        agency_name: agencyName
      };
    });

  const sanitizedAgencies = agencies.filter((a: any) => a.id && UUID_REGEX.test(a.id));
  const sanitizedTenants = tenants.filter((t: any) => t.id && UUID_REGEX.test(t.id));

  return (
    <MessagesUI
      initialMessages={sanitizedMessages}
      initialTotalMessagesToday={totalMessagesToday}
      initialActiveConversations={activeConversationsCount}
      agencies={sanitizedAgencies}
      tenants={sanitizedTenants}
    />
  );
}
