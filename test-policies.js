const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  'https://dojbgvjrswktblkwwffx.supabase.co',
  'sb_secret_ZhkrITyDNR_Adbdn74V17A_Lvz0_scQ'
);

async function test() {
  const { data, error } = await supabaseAdmin.from('pg_policies').select('*').eq('tablename', 'tenants');
  console.log(data, error);
}

test();
