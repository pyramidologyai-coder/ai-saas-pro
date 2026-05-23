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

async function inspectColumns() {
  // Let's run a query to get column details
  const { data, error } = await supabase.from('agencies').select('name, user_id').limit(1);
  if (error) {
    console.error("Error:", error);
    return;
  }
  // Try inserting a dummy agency without user_id to see if it's nullable
  const { data: insData, error: insError } = await supabase.from('agencies').insert({
    name: 'TEST NULLABLE USER_ID',
    contact_email: 'testnullable@example.com',
    plan_type: 'starter',
    status: 'active',
    commission_rate: 10
  }).select();

  if (insError) {
    console.log("Insert failed. user_id is probably NOT NULL or another error:", insError.message);
  } else {
    console.log("Insert succeeded! user_id is nullable. Succeeded row:", insData);
    // Delete the test row
    await supabase.from('agencies').delete().eq('id', insData[0].id);
  }
}

inspectColumns();
