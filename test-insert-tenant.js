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
  const email = 'test_google_' + Date.now() + '@gmail.com';
  
  // Create user
  const { data: user, error: signUpError } = await supabase.auth.signUp({
    email,
    password: 'password123',
  });

  if (signUpError) return console.log('Signup error:', signUpError);

  // Wait a bit
  await new Promise(r => setTimeout(r, 1000));

  // Check if tenant was created by trigger
  const { data: t } = await supabase.from('tenants').select('*').eq('user_id', user.user.id);
  console.log('Tenant created by trigger?', t?.length > 0);

  // If we delete the tenant to simulate missing trigger
  if (t?.length > 0) {
    await supabaseAdmin.from('tenants').delete().eq('user_id', user.user.id);
  }

  // Now simulate onboarding insert
  const { data: newTenant, error } = await supabase.from('tenants').insert({
    user_id: user.user.id,
    name: 'نشاط تجاري جديد',
    type: 'clinic',
    working_hours: `يومياً من 10:00 إلى 22:00`,
    slug: 'b-' + Math.floor(Math.random() * 100000)
  }).select().single();

  console.log('INSERT ERROR DETAILS:', error);
  console.log('INSERT SUCCESS:', newTenant);

  // Cleanup
  await supabaseAdmin.auth.admin.deleteUser(user.user.id);
}

test();
