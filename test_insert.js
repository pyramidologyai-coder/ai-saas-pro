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

async function testInsert() {
  const insertRes = await supabase.from('messages').insert({
    tenant_id: 'bbd71d55-7c8d-4d5f-97f4-8854ac796807',
    session_id: '201115351111',
    sender: 'ai',
    text: 'test AI message'
  });
  console.log('Insert AI Message:', insertRes);
}

testInsert();
