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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function fixBranches() {
  const { data, error } = await supabase
    .from('branches')
    .update({ tenant_id: 'bbd71d55-7c8d-4d5f-97f4-8854ac796807' })
    .eq('tenant_id', '13814bff-a653-439a-8891-2c5a81124eb8');
  console.log('Update Branches:', { data, error });
}

fixBranches();
