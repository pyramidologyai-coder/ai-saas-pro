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
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const sql = `
CREATE OR REPLACE FUNCTION create_agency(
  p_name text,
  p_contact_email text,
  p_whatsapp_number text,
  p_commission_rate numeric,
  p_plan_type text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id uuid;
BEGIN
  IF NOT is_master_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF TRIM(p_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Name required');
  END IF;

  IF p_contact_email !~ '^[^@]+@[^@]+\\.[^@]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid email');
  END IF;

  IF p_commission_rate < 0 OR p_commission_rate > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid commission rate');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM plans WHERE slug = p_plan_type AND is_active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid plan');
  END IF;

  INSERT INTO agencies (
    name, contact_email, whatsapp_number,
    commission_rate, plan_type,
    subscription_status, status
  ) VALUES (
    TRIM(p_name), LOWER(TRIM(p_contact_email)),
    TRIM(p_whatsapp_number), p_commission_rate,
    p_plan_type, 'active', 'active'
  )
  RETURNING id INTO v_agency_id;

  INSERT INTO audit_logs (action_type, entity_type, entity_id, actor_id, changes)
  VALUES (
    'agency_created', 'agency', v_agency_id::text, auth.uid(),
    jsonb_build_object(
      'name', TRIM(p_name),
      'email', LOWER(TRIM(p_contact_email)),
      'plan', p_plan_type,
      'commission_rate', p_commission_rate
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'agency_id', v_agency_id,
    'email', LOWER(TRIM(p_contact_email))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_agency(text, text, text, numeric, text) TO authenticated;
`;

async function execute() {
  console.log("Attempting to run SQL via exec_sql RPC...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error("Error running SQL:", error);
  } else {
    console.log("SQL executed successfully! Result:", data);
  }
}

execute();
