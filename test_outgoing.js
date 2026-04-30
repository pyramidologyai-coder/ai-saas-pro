const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  if(line.trim() && !line.startsWith('#')) {
    const [key, ...rest] = line.split('=');
    env[key.trim()] = rest.join('=').trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data } = await supabase.rpc('get_constraint', { constraint_name: 'messages_sender_check' });
  console.log('Constraint:', data);
}

// Alternatively just try inserting with sender='outgoing'
async function testOutgoing() {
  const insertRes = await supabase.from('messages').insert({
    tenant_id: 'bbd71d55-7c8d-4d5f-97f4-8854ac796807',
    session_id: '201115351111',
    sender: 'outgoing',
    text: 'test AI message'
  });
  console.log('Insert Outgoing Message:', insertRes);
}

testOutgoing();
