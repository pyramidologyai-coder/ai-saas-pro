import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const sanitize = (value: string | undefined) =>
  (value ?? '').replace(/[^\x20-\x7E]/g, '').trim();

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient() {
  if (adminClient) return adminClient;

  const supabaseUrl = sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = sanitize(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}
