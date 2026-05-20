const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  console.log("Starting custom SQL execution in Supabase via exec_sql...");

  const queries = [
    // 1. Drop duplicate get_master_clients functions
    `DROP FUNCTION IF EXISTS public.get_master_clients();`,
    `DROP FUNCTION IF EXISTS public.get_master_clients(integer, integer, text, text, text);`,

    // 2. Re-create get_master_clients properly
    `CREATE OR REPLACE FUNCTION public.get_master_clients()
RETURNS JSON AS $$
DECLARE
  v_clients JSON;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (
      raw_user_meta_data->>'role' = 'master_admin'
      OR raw_app_meta_data->>'role' = 'master_admin'
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE(json_agg(t), '[]'::json) INTO v_clients
  FROM (
    SELECT t.id, t.name, t.type, t.subscription_tier as plan_type, t.status, t.created_at,
           t.messages_used, t.messages_limit, t.google_calendar_refresh_token IS NOT NULL as has_calendar,
           a.name as agency_name
    FROM tenants t
    LEFT JOIN agencies a ON t.agency_id = a.id
    ORDER BY t.created_at DESC
  ) t;

  RETURN v_clients;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`,

    // 3. Update verify_master_admin_role to read directly from database
    `CREATE OR REPLACE FUNCTION public.verify_master_admin_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (
      raw_user_meta_data->>'role' = 'master_admin'
      OR raw_app_meta_data->>'role' = 'master_admin'
    )
  );
END;
$$;`,

    // 4. Update is_master_admin to do the same check
    `CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (
      raw_user_meta_data->>'role' = 'master_admin'
      OR raw_app_meta_data->>'role' = 'master_admin'
    )
  );
END;
$$;`,

    // 5. Update user metadata for the master admin account
    `UPDATE auth.users 
SET raw_user_meta_data = 
  COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  jsonb_build_object('role', 'master_admin')
WHERE id = 'b7326034-0af1-49ee-865c-f842f3e47fd2';`
  ];

  for (let i = 0; i < queries.length; i++) {
    console.log(`Executing query #${i + 1}...`);
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: queries[i] });
    if (error) {
      console.error(`Error executing query #${i + 1}:`, error);
    } else {
      console.log(`Successfully executed query #${i + 1}. Result:`, data);
    }
  }

  console.log("SQL tasks complete.");
}

run();
