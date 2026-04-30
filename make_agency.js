const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  if(line.trim() && !line.startsWith('#')) {
    const [key, ...val] = line.split('=');
    env[key.trim()] = val.join('=').trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function makeAgency() {
  // Get first user (the admin)
  const { data: users, error: userErr } = await supabase.from('profiles').select('id');
  if (!users || users.length === 0) return console.log('No users found');
  
  const userId = users[0].id;
  
  // Insert agency
  const { data, error } = await supabase.from('agencies').insert({
    user_id: userId,
    name: 'وكالتي للتسويق',
    subscription_status: 'active',
    custom_domain: 'agency.com'
  });
  
  if (error && error.code !== '23505') {
    console.log(error);
  } else {
    console.log('Agency created or already exists');
  }
}
makeAgency();
