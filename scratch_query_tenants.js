const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    });
  }
}
loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, name, agency_id, agencies(name, subscription_status)');
  
  if (error) {
    console.error("Error fetching tenants:", error);
  } else {
    console.log(`Found ${tenants.length} tenants:`);
    tenants.forEach(t => {
      console.log(`- ID: ${t.id}, Name: ${t.name}, Agency ID: ${t.agency_id}, Agency Relation:`, t.agencies);
    });
  }
}

run();
