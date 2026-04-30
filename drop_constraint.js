const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  if(line.trim() && !line.startsWith('#')) {
    const [key, ...rest] = line.split('=');
    env[key.trim()] = rest.join('=').trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function fix() {
  const { error } = await supabase.rpc('run_sql', {
    sql_query: 'ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_type_check;'
  });
  console.log('Drop constraint error via RPC (if exists):', error);
  
  // If we don't have run_sql RPC, we might need to do it via supabase dashboard or cli.
  // Actually, I can use the Supabase CLI if it's installed, or just explain to the user.
}

fix();
