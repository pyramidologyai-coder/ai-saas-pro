import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { MasterMarketingUI } from '@/components/master-admin/MarketingUI';

export const dynamic = 'force-dynamic';

async function withTimeout<T>(promise: Promise<T>, ms = 10000): Promise<T> {
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

export default async function MasterAdminMarketingPage() {
  const supabase = await createClient();

  let redirectTarget: string | null = null;
  let campaignsData: any[] = [];
  let agenciesData: any[] = [];

  try {
    const [userRes, isMasterRes, campaignsRes, agenciesRes] = await Promise.allSettled([
      withTimeout(supabase.auth.getUser()),
      withTimeout(Promise.resolve(supabase.rpc('verify_master_admin_role'))),
      withTimeout(Promise.resolve(
        supabase
          .from('campaigns')
          .select(`
            id,
            name,
            type,
            status,
            recipients_count,
            sent_count,
            failed_count,
            template_name,
            scheduled_at,
            sent_at,
            created_at,
            tenant_id,
            agency_id,
            tenants ( name ),
            agencies ( name )
          `)
          .order('created_at', { ascending: false })
          .limit(200)
      )),
      withTimeout(Promise.resolve(supabase.from('agencies').select('id, name')))
    ]);

    const user = userRes.status === 'fulfilled' ? userRes.value.data.user : null;
    const isMaster = isMasterRes.status === 'fulfilled' ? isMasterRes.value.data : false;
    const campaigns = campaignsRes.status === 'fulfilled' ? campaignsRes.value.data : [];
    const agencies = agenciesRes.status === 'fulfilled' ? agenciesRes.value.data : [];

    if (!user) {
      redirectTarget = '/auth';
    } else if (!isMaster) {
      redirectTarget = '/admin';
    } else {
      campaignsData = campaigns || [];
      agenciesData = agencies || [];
    }
  } catch (e) {
    console.error('Error in MasterAdminMarketingPage:', e);
    redirectTarget = '/admin';
  }

  if (redirectTarget) {
    redirect(redirectTarget);
  }

  // UUID Validation & Scrubbing Sensitive Data
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  const sanitizedCampaigns = campaignsData
    .filter((c: any) => c.id && UUID_REGEX.test(c.id))
    .map((c: any) => {
      const { meta_token, api_key, gemini_api_key, ...safeCampaign } = c;
      return {
        ...safeCampaign,
        tenant_name: c.tenants?.name || 'مستأجر غير معروف',
        agency_name: c.agencies?.name || 'بدون وكالة'
      };
    });

  const sanitizedAgencies = agenciesData.filter((a: any) => a.id && UUID_REGEX.test(a.id));

  return <MasterMarketingUI campaigns={sanitizedCampaigns} agencies={sanitizedAgencies} />;
}
