const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const query = `
CREATE OR REPLACE FUNCTION calculate_master_revenue()
RETURNS DECIMAL AS $$
DECLARE
  v_revenue DECIMAL := 0;
BEGIN
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
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: query });
  console.log("exec_sql result:", data, error);
}
run();
