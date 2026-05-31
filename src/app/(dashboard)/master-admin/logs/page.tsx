import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { LogsUI } from '@/components/master-admin/LogsUI';

export const dynamic = 'force-dynamic';

async function withTimeout<T>(
  promise: Promise<T> | PromiseLike<T>,
  ms = 10000
): Promise<Awaited<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
  try {
    const result = await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('timeout')), ms);
      })
    ]);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    return result;
  } catch (error) {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    throw error;
  }
}

export default async function SuperAdminLogsPage() {
  const supabase = await createClient();

  let redirectTarget: string | null = null;
  let logsData: any[] = [];

  try {
    const [userRes, isMasterRes, logsRes] = await Promise.allSettled([
      withTimeout(supabase.auth.getUser(), 10000),
      withTimeout(Promise.resolve(supabase.rpc('verify_master_admin_role')), 5000),
      withTimeout(
        supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500),
        15000
      )
    ]);

    const user = userRes.status === 'fulfilled' && userRes.value.data ? userRes.value.data.user : null;
    const isMaster = isMasterRes.status === 'fulfilled' ? isMasterRes.value.data : false;
    
    if (logsRes.status === 'fulfilled' && (logsRes.value as any).data) {
      logsData = (logsRes.value as any).data;
    }

    if (!user) {
      redirectTarget = '/auth';
    } else if (!isMaster) {
      redirectTarget = '/admin';
    }
  } catch (e) {
    console.error('Error loading Master Admin Logs Page:', e);
    if (!redirectTarget) redirectTarget = '/admin';
  }

  if (redirectTarget) {
    redirect(redirectTarget);
  }

  // Scrub any sensitive data from the audit logs' changes/details fields before rendering
  const scrubKeys = ['gemini_api_key', 'meta_token', 'commission_rate'];
  
  const cleanLogs = logsData.map(log => {
    let cleanChanges = log.changes;
    if (typeof cleanChanges === 'object' && cleanChanges !== null) {
      cleanChanges = { ...cleanChanges };
      scrubKeys.forEach(k => {
        if (k in cleanChanges) delete cleanChanges[k];
      });
      // also if changes contains oldValue/newValue or nested configurations
      for (const key in cleanChanges) {
        if (typeof cleanChanges[key] === 'object' && cleanChanges[key] !== null) {
          cleanChanges[key] = { ...cleanChanges[key] };
          scrubKeys.forEach(k => {
            if (k in cleanChanges[key]) delete cleanChanges[key][k];
          });
        }
      }
    }
    return {
      ...log,
      action: log.action_type || 'unknown', // ✅ الإصلاح
      performed_by: log.actor_id || 'unknown', // ✅ map actor_id
      details: cleanChanges, // ✅ map changes
      changes: cleanChanges
    };
  });

  return <LogsUI initialLogs={cleanLogs} />;
}
