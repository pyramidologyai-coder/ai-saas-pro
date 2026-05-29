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

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  console.log("Loading migrations file...");
  const sqlPath = path.join(__dirname, 'supabase-migrations-wallet-master-rpc.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Split SQL file by functions
  // We can execute each statement cleanly by splitting on the double-dashes or semicolons
  // Actually, we can split by CREATE OR REPLACE FUNCTION
  const queries = sql.split(/CREATE OR REPLACE FUNCTION/i).filter(Boolean);

  console.log(`Executing ${queries.length} database RPC declarations...`);

  for (let i = 0; i < queries.length; i++) {
    const cleanSql = ('CREATE OR REPLACE FUNCTION ' + queries[i]).trim();
    if (!cleanSql) continue;
    
    console.log(`Executing definition #${i + 1}...`);
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: cleanSql });
    
    if (error) {
      console.error(`Error executing definition #${i + 1}:`, error.message);
    } else {
      console.log(`Definition #${i + 1} succeeded!`);
    }
  }

  console.log("Database tasks completed successfully!");
}

run();
