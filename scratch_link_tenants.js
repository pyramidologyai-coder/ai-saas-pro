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
  // Let's link tenants:
  // Tenant 1 -> ASH TEST AGENCY (active: 685d56d3-c218-4cc7-8791-6194608bbaf1)
  const { error: err1 } = await supabase
    .from('tenants')
    .update({ agency_id: '685d56d3-c218-4cc7-8791-6194608bbaf1' })
    .eq('id', '67b7d0af-80aa-412c-b155-159ca12621ed');
  
  if (err1) console.error("Error linking Tenant 1:", err1);
  else console.log("Linked Tenant 1 to active agency!");

  // Tenant 2 -> ash test agencuuuuu (suspended: 895552ab-4ea8-4047-b122-03174f3c3ece)
  const { error: err2 } = await supabase
    .from('tenants')
    .update({ agency_id: '895552ab-4ea8-4047-b122-03174f3c3ece' })
    .eq('id', 'd0088751-f5af-463c-ba8b-a020aef7b735');
  
  if (err2) console.error("Error linking Tenant 2:", err2);
  else console.log("Linked Tenant 2 to suspended agency!");

  // Tenant 3 -> ash test agencuuuuu (suspended: 895552ab-4ea8-4047-b122-03174f3c3ece)
  const { error: err3 } = await supabase
    .from('tenants')
    .update({ agency_id: '895552ab-4ea8-4047-b122-03174f3c3ece' })
    .eq('id', '2a52386a-b518-4b48-ab47-570cea135516');
  
  if (err3) console.error("Error linking Tenant 3:", err3);
  else console.log("Linked Tenant 3 to suspended agency!");
}

run();
