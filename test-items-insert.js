const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dojbgvjrswktblkwwffx.supabase.co',
  'sb_secret_ZhkrITyDNR_Adbdn74V17A_Lvz0_scQ'
);

async function test() {
  const { data: tenantData } = await supabase.from('tenants').select('id').limit(1).single();
  if (!tenantData) return console.log('No tenant found');
  
  const { data, error } = await supabase.from('items').insert({
    tenant_id: tenantData.id,
    name: 'Test Item',
    price: 100,
    duration_minutes: 30
  });
  console.log('Error:', error);
}

test();
