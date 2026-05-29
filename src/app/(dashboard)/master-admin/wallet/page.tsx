import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { WalletUI } from '@/components/master-admin/WalletUI';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import React from 'react';

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

export default async function WalletPage({
  searchParams
}: {
  searchParams: Promise<{ lang?: string }>
}) {
  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient(
    { cookies: () => cookieStore as any },
    {
      supabaseUrl: SUPABASE_URL,
      supabaseKey: SUPABASE_ANON_KEY
    }
  );

  let redirectTarget: string | null = null;
  let summary = {
    total_credited: 0,
    total_debited: 0,
    current_balance: 0,
    agencies_count: 0
  };
  let transactions: any[] = [];
  let agencies: any[] = [];

  try {
    // 1. Verify User Authentication securely on the server
    const userRes = await withTimeout(Promise.resolve(supabase.auth.getUser()), 10000);
    const user = userRes.data?.user;

    if (!user) {
      redirectTarget = '/auth';
    } else {
      // 2. Verify Master Admin Role (using RPC checks and fallback user metadata checks)
      const [verifyRes, isMasterRes] = await Promise.allSettled([
        withTimeout(Promise.resolve(supabase.rpc('verify_master_admin_role')), 5000),
        withTimeout(Promise.resolve(supabase.rpc('is_master_admin')), 5000)
      ]);

      const verifyData = verifyRes.status === 'fulfilled' ? verifyRes.value.data : false;
      const fallbackData = isMasterRes.status === 'fulfilled' ? isMasterRes.value.data : false;
      if (!verifyData && !fallbackData) {
        redirectTarget = '/admin';
      }
    }
  } catch (authErr) {
    console.error('Wallet authorization verification failed:', authErr);
    redirectTarget = '/auth';
  }

  // 3. Redirect outside of the main try/catch blocks
  if (redirectTarget) {
    redirect(redirectTarget);
  }

  // 4. Retrieve database entities with strict timeouts and robust server-side fallbacks
  try {
    const [summaryRes, transactionsRes, agenciesRes] = await Promise.allSettled([
      withTimeout(Promise.resolve(supabase.rpc('get_wallet_summary')), 5000),
      withTimeout(Promise.resolve(supabase.rpc('get_wallet_transactions')), 5000),
      withTimeout(Promise.resolve(supabase.from('agencies').select('id, name, contact_email')), 5000)
    ]);

    // Parse summary or compute on-demand if RPC is not deployed
    if (summaryRes.status === 'fulfilled' && !summaryRes.value.error && summaryRes.value.data) {
      summary = summaryRes.value.data;
    } else {
      console.warn('get_wallet_summary RPC is unavailable, performing server-side database calculation.');
      try {
        const { data: ledger } = await supabase.from('wallet_ledger').select('credit, debit');
        let totalCredited = 0;
        let totalDebited = 0;
        ledger?.forEach((entry: any) => {
          totalCredited += Number(entry.credit) || 0;
          totalDebited += Number(entry.debit) || 0;
        });
        const { count } = await supabase.from('agencies').select('id', { count: 'exact', head: true });
        summary = {
          total_credited: totalCredited,
          total_debited: totalDebited,
          current_balance: totalCredited - totalDebited,
          agencies_count: count || 0
        };
      } catch (sumErr) {
        console.error('Failed to run summary fallback:', sumErr);
      }
    }

    // Parse transactions or fetch directly if RPC is not deployed
    if (transactionsRes.status === 'fulfilled' && !transactionsRes.value.error && transactionsRes.value.data) {
      transactions = transactionsRes.value.data;
    } else {
      console.warn('get_wallet_transactions RPC is unavailable, performing server-side database query.');
      try {
        const { data: ledger } = await supabase
          .from('wallet_ledger')
          .select(`
            id,
            agency_id,
            tenant_id,
            transaction_type,
            credit,
            debit,
            description,
            reference_id,
            created_at,
            agency:agencies(name)
          `)
          .order('created_at', { ascending: false });

        transactions = ledger?.map((entry: any) => ({
          id: entry.id,
          agency_id: entry.agency_id,
          tenant_id: entry.tenant_id,
          agency_name: entry.agency?.name || null,
          transaction_type: entry.transaction_type,
          credit: Number(entry.credit) || 0,
          debit: Number(entry.debit) || 0,
          description: entry.description,
          reference_id: entry.reference_id,
          created_at: entry.created_at
        })) || [];
      } catch (txErr) {
        console.error('Failed to run transactions fallback:', txErr);
      }
    }

    // Parse agencies
    if (agenciesRes.status === 'fulfilled' && !agenciesRes.value.error && agenciesRes.value.data) {
      agencies = agenciesRes.value.data;
    }
  } catch (err) {
    console.error('Error fetching master admin wallet details:', err);
  }

  const rawLang = resolvedSearchParams?.lang ?? 'ar';
  const lang: Lang = VALID_LANGS.includes(rawLang as Lang) ? (rawLang as Lang) : 'ar';

  return (
    <WalletUI 
      initialSummary={summary} 
      initialTransactions={transactions} 
      agencies={agencies}
      initialLang={lang} 
    />
  );
}
