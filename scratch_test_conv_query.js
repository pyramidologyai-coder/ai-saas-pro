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

async function test() {
  console.log("Querying conversations...");
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      id,
      channel,
      customer_name,
      last_message_time,
      tenant_id,
      tenants (
        name,
        agency_id,
        agencies ( name )
      )
    `)
    .limit(2);
  
  if (error) {
    console.error("Query failed:", error);
  } else {
    console.log("Query succeeded! Conversations:", data);
  }
}

test();
