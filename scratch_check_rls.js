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
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkRLS() {
  const query = `
    SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check 
    FROM pg_policies 
    WHERE tablename = 'agencies';
  `;
  
  console.log("Checking RLS policies on 'agencies' table...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: query });
  
  if (error) {
    if (error.code === 'PGRST202') {
      console.log("exec_sql RPC is not available. Let's list SQL files instead.");
      // We can also query using a different approach if we had one, but let's fall back to reading files.
      checkSqlFiles();
    } else {
      console.error("Error executing query:", error);
    }
  } else {
    console.log("RLS Policies:", JSON.stringify(data, null, 2));
  }
}

function checkSqlFiles() {
  const files = fs.readdirSync(__dirname);
  const sqlFiles = files.filter(f => f.endsWith('.sql'));
  sqlFiles.forEach(file => {
    const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
    if (content.toLowerCase().includes('policy') && content.toLowerCase().includes('agencies')) {
      console.log(`Found RLS/Policy mention in file: ${file}`);
      // Find lines with policy or agencies
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('policy') || line.toLowerCase().includes('agencies')) {
          console.log(`  L${idx+1}: ${line.trim()}`);
        }
      });
    }
  });
}

checkRLS();
