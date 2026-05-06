const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envs = ['.env.local', '.env.prod.local', '.env.production'];
const env = {};

for (const file of envs) {
  if (fs.existsSync(file)) {
    const envFile = fs.readFileSync(file, 'utf8');
    envFile.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/['"]/g, '');
        if (key && value) env[key] = value;
      }
    });
  }
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(url, key);

async function checkTables() {
  const { error: cError } = await supabase.from('campaigns').select('id').limit(1);
  console.log('campaigns check:', cError ? cError.message : 'EXISTS');

  const { error: convError } = await supabase.from('conversations').select('id').limit(1);
  console.log('conversations check:', convError ? convError.message : 'EXISTS');
  
  const { error: tenantsError } = await supabase.from('tenants').select('id').limit(1);
  console.log('tenants check:', tenantsError ? tenantsError.message : 'EXISTS');
}

checkTables();
