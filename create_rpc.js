const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const query = `
CREATE OR REPLACE FUNCTION calculate_master_revenue()
RETURNS DECIMAL AS $$
DECLARE
  v_revenue DECIMAL := 0;
BEGIN
  -- We allow service_role to bypass the check, otherwise check for master_admin
  IF auth.role() != 'service_role' AND (auth.jwt() -> 'user_metadata' ->> 'role') != 'master_admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE(SUM(
    CASE plan_type
      WHEN 'starter' THEN 49
      WHEN 'growth'  THEN 99
      WHEN 'pro'     THEN 199
      WHEN 'vip'     THEN 399
      ELSE 0
    END
  ), 0) INTO v_revenue
  FROM agencies
  WHERE status = 'active';

  RETURN v_revenue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  
  // Note: we'll use a hack to execute this since supabase js doesn't have a direct query builder for DDL.
  // We can try to use a pre-existing RPC or just insert it using a standard rest call if there's an endpoint.
  // Actually, we can use the supabase REST API if we have it, or we can use the `rpc` call if `exec_sql` exists.
  
  console.log("To create this function, the user will need to run it in Supabase SQL editor if exec_sql isn't available.");
}
run();
