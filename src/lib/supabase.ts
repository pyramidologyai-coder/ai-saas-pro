import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ?? 'https://dojbgvjrswktblkwwffx.supabase.co';

// Publishable (anon) key — intentionally in source, safe to be public
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ?? 'sb_publishable_GgL2OrovQ9csIwroqg812g_qQr0jJhm';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
