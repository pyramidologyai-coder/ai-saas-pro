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

function sanitizeMessageText(text: string): string {
  if (!text) return '';
  // Mask OTP / Verification codes (4 to 6 digit numbers)
  let sanitized = text.replace(/\b\d{4,6}\b/g, '****');
  // Mask credit card numbers (simple 13-16 digit pattern)
  sanitized = sanitized.replace(/\b(?:\d[ -]*?){13,16}\b/g, '**** **** **** ****');
  // Mask email addresses
  sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***');
  return sanitized;
}

export default async function MasterAdminMessagesPage() {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient(
    { cookies: () => cookieStore as any },
    { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_ANON_KEY }
  );

  let redirectTarget: string | null = null;
  let messagesData: any[] = [];
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
      convsRes,
      todayMsgsRes,
      agenciesRes,
      tenantsRes
    ] = await Promise.allSettled([
      withTimeout(supabase.auth.getUser()),
      withTimeout(Promise.resolve(supabase.rpc('verify_master_admin_role'))),
      withTimeout(
        Promise.resolve(
          supabase
            .from('messages')
            .select(`
              id,
              tenant_id,
              session_id,
              sender,
              text,
              created_at,
              tenants (
                name,
                agency_id,
                agencies (
                  name
                )
              )
            `)
            .order('created_at', { ascending: false })
            .limit(50)
        )
      ),
      withTimeout(
        Promise.resolve(
          supabase
            .from('conversations')
            .select('id', { count: 'exact', head: true })
        )
      ),
      withTimeout(
        Promise.resolve(
          supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', startOfTodayISO)
        )
      ),
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
      // Parse Messages
      if (messagesRes.status === 'fulfilled' && messagesRes.value.data) {
        messagesData = messagesRes.value.data;
      }

      // Parse Active Conversations
      if (convsRes.status === 'fulfilled' && convsRes.value.count !== null) {
        activeConversationsCount = convsRes.value.count || 0;
      }

      // Parse Today's Messages Count
      if (todayMsgsRes.status === 'fulfilled' && todayMsgsRes.value.count !== null) {
        totalMessagesToday = todayMsgsRes.value.count || 0;
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

  const sanitizedMessages = messagesData
    .filter((m: any) => m.id && UUID_REGEX.test(m.id))
    .map((m: any) => {
      // Map tenant and agency info into flat keys for UI rendering
      const tenantName = m.tenants?.name || 'مستأجر غير معروف';
      const agencyId = m.tenants?.agency_id || null;
      const agencyName = m.tenants?.agencies?.name || 'بدون وكالة';

      // ⛔ Secure masking of sensitive content
      const safeText = sanitizeMessageText(m.text || '');

      return {
        id: m.id,
        tenant_id: m.tenant_id,
        session_id: m.session_id,
        sender: m.sender,
        text: safeText,
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
