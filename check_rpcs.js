const { createClient } = require('@supabase/supabase-js');


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase credentials in .env.local or .env.prod.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkRPCs() {
  console.log("Checking RPCs...");
  
  const rpcs = [
    'verify_master_admin_role',
    'get_master_dashboard_data'
  ];

  let missing = false;

  for (const rpc of rpcs) {
    const { data, error } = await supabase.rpc(rpc);
    if (error && error.code === 'PGRST202') { // Function not found
      console.log(`❌ RPC '${rpc}' is MISSING.`);
      missing = true;
    } else {
      console.log(`✅ RPC '${rpc}' EXISTS.`);
    }
  }

  if (missing) {
    console.log("\nSome RPCs are missing. You need to add them.");
  } else {
    console.log("\nAll RPCs are present!");
  }
}

checkRPCs();
