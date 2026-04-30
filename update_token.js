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

async function updateToken() {
  const { data, error } = await supabase
    .from('tenants')
    .update({ meta_token: 'EAAXuONOAqWwBRWNrZAQxIsSBXAKH26ZCWYZCKKlQFGRRBVBvEg3t9SzjdlbhWQxVMJ8W4RV0uKhFdO4vl2rzeeGRIJ8VJ4C2oslih6DMMcz1zPgJ0eQylgn1LqLsRj9jbtZBmGrsZATwCJ52cvZBPwjuNBHronzasYyoGduxZBdmYZBwsigXE0rlkZC19gwtgANVx38r44z7ZCG6SU462ka45ZCnRNmUxohY4ffr1ZCVZBo0hq7n7ZCNS9KaBy8LFQj3kND20oVTIkkArt4O9MJHVE7yY79Ucxa1zFAC2U' })
    .eq('id', 'bbd71d55-7c8d-4d5f-97f4-8854ac796807');
    
  console.log('Update:', { data, error });
}

updateToken();
