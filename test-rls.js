const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dojbgvjrswktblkwwffx.supabase.co',
  'sb_publishable_GgL2OrovQ9csIwroqg812g_qQr0jJhm'
);

const supabaseAdmin = createClient(
  'https://dojbgvjrswktblkwwffx.supabase.co',
  'sb_secret_ZhkrITyDNR_Adbdn74V17A_Lvz0_scQ'
);

async function test() {
  // 1. Create a test user
  const email = 'ahmad_test_' + Date.now() + '@gmail.com';
  const password = 'password123';
  
  const { data: user, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { business_name: 'Test Clinic', business_type: 'clinic' }
    }
  });

  if (signUpError) {
    console.log('SignUp Error:', signUpError);
    return;
  }

  // 2. Wait a bit for the trigger to create the tenant
  await new Promise(r => setTimeout(r, 2000));

  // 3. Get the tenant
  const { data: tenants, error: tErr } = await supabase.from('tenants').select('*');
  console.log('Tenants:', tenants, tErr);

  if (!tenants || tenants.length === 0) {
    console.log('Tenant not created by trigger');
    return;
  }

  // 4. Try to insert an item
  const { data, error } = await supabase.from('items').insert({
    tenant_id: tenants[0].id,
    name: 'Test Service',
    price: 150,
    duration_minutes: 45
  }).select().single();

  console.log('Insert Result:', data);
  console.log('Insert Error:', error);

  // Cleanup
  await supabaseAdmin.auth.admin.deleteUser(user.user.id);
}

test();
