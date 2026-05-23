const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

async function run() {
  const query = `
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'public'
    AND routine_name ILIKE '%agency%';
  `;

  console.log("Running SQL to search for agency RPCs...");
  
  // We can execute SQL query via the exec_sql RPC
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: query });
  
  if (error) {
    console.error("Error executing query:", error.message);
  } else {
    console.log("Successfully retrieved agency routines:");
    console.log(JSON.stringify(data, null, 2));
  }
}

run();
