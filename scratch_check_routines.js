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

async function checkRoutines() {
  // We can select routines by running a query if we have an RPC, 
  // or we can search migration files to see if any routines were created.
  // Wait, let's see if we can query it using Postgres information_schema.
  // Since we don't have exec_sql, let's query the database via normal selects if there's any table, 
  // or let's search migration files for 'suspend' or 'activate' to see if there is any SQL routine.
  console.log("Checking migration files for 'suspend' or 'activate' routines...");
  
  // Let's read the migration files in the workspace
  const files = fs.readdirSync(__dirname);
  const sqlFiles = files.filter(f => f.endsWith('.sql'));
  
  let found = [];
  sqlFiles.forEach(file => {
    const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
    if (content.toLowerCase().includes('suspend') || content.toLowerCase().includes('activate')) {
      found.push(file);
    }
  });
  
  console.log("Found occurrences of 'suspend' or 'activate' in migration files:", found);
}

checkRoutines();
