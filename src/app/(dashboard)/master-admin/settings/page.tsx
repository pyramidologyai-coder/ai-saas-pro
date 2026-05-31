import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { SettingsUI } from '@/components/master-admin/SettingsUI';

export const dynamic = 'force-dynamic';

const VALID_LANGS = ['ar', 'en', 'fr'] as const;
type Lang = typeof VALID_LANGS[number];

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

export default async function SuperAdminSettingsPage({
  searchParams
}: {
  searchParams: { lang?: string }
}) {
  const supabase = await createClient();

  let redirectTarget: string | null = null;
  let platformSettings: any = null;
  let plans: any[] = [];
  let failedLoginsCount = 0;
  let user: any = null;

  try {
    const [userRes, isMasterRes, settingsRes, plansRes, failedLoginsRes, featuresRes] = await Promise.allSettled([
      withTimeout(supabase.auth.getUser(), 10000),
      withTimeout(Promise.resolve(supabase.rpc('verify_master_admin_role')), 5000),
      withTimeout(supabase.from('platform_settings').select('*').limit(1).maybeSingle(), 5000),
      withTimeout(supabase.rpc('get_plans_with_stats'), 5000),
      withTimeout(
        supabase
          .from('audit_logs')
          .select('*', { count: 'exact', head: true })
          .eq('action_type', 'LOGIN_FAILED'),
        5000
      ),
      withTimeout(supabase.from('plan_features').select('*'), 5000)
    ]);

    user = userRes.status === 'fulfilled' && userRes.value.data ? userRes.value.data.user : null;
    const isMaster = isMasterRes.status === 'fulfilled' ? isMasterRes.value.data : false;

    let isAuthorized = !!isMaster;
    if (!isAuthorized && user) {
      isAuthorized = user.user_metadata?.role === 'master_admin';
    }

    if (!user) {
      redirectTarget = '/auth';
    } else if (!isAuthorized) {
      redirectTarget = '/admin';
    }

    if (settingsRes.status === 'fulfilled' && settingsRes.value) {
      const val = settingsRes.value as any;
      if (!val.error) {
        platformSettings = val.data;
      }
    }

    if (plansRes.status === 'fulfilled' && plansRes.value) {
      const val = plansRes.value as any;
      if (!val.error) {
        plans = val.data || [];
      }
    }

    if (failedLoginsRes.status === 'fulfilled' && failedLoginsRes.value) {
      const val = failedLoginsRes.value as any;
      failedLoginsCount = val.count || 0;
    }

    if (featuresRes.status === 'fulfilled' && featuresRes.value) {
      const val = featuresRes.value as any;
      if (!val.error && val.data) {
        const features = val.data;
        plans = plans.map((p: any) => ({
          ...p,
          features: features.filter((f: any) => f.plan_id === p.id)
        }));
      }
    }
  } catch (error) {
    console.error('Error loading SuperAdminSettingsPage data:', error);
    if (!redirectTarget) {
      redirectTarget = '/admin';
    }
  }

  if (redirectTarget) {
    redirect(redirectTarget);
  }

  const rawLang = searchParams?.lang ?? 'ar';
  const lang: Lang = VALID_LANGS.includes(rawLang as Lang) ? (rawLang as Lang) : 'ar';

  return (
    <SettingsUI
      initialPlatformSettings={platformSettings}
      initialPlans={plans}
      failedLoginsCount={failedLoginsCount}
      user={user}
      initialLang={lang}
    />
  );
}
