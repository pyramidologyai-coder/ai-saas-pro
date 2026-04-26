import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dojbgvjrswktblkwwffx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvamJndmpyc3drdGJsa3d3ZmZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzM5OTYsImV4cCI6MjA5MjI0OTk5Nn0.yKSHL2zh3yc6PjFppGa6dbkzd7b2gwaPKPlMlsSdPME';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Check your .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
