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

async function test() {
  const { data, error } = await supabase.from('tenants').select('*').limit(1);
  if(data && data.length > 0) {
    const keys = Object.keys(data[0]);
    console.log("Columns in tenants:");
    console.log(keys.filter(k => ['custom_domain', 'enable_reminders', 'zapier_webhook', 'agency_id'].includes(k)));
  } else if (error) {
    console.error("Error:", error);
  } else {
    console.log("No data, but query succeeded");
  }
}

test();
