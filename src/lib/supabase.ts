import { createClient } from '@supabase/supabase-js';

// Strip PowerShell UTF-16 artifacts (NULL bytes, BOM) that corrupt env vars stored via CLI pipe
const sanitize = (val: string | undefined, fallback: string) =>
  (val ?? '').replace(/[^\x20-\x7E]/g, '').trim() || fallback;

const supabaseUrl = sanitize(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  'https://dojbgvjrswktblkwwffx.supabase.co'
);

// Publishable (anon) key — intentionally in source, safe to be public
const supabaseAnonKey = sanitize(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  'sb_publishable_GgL2OrovQ9csIwroqg812g_qQr0jJhm'
);

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
