require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  console.log('Bookings:', bookings);
  const { data: msgs } = await supabase.from('messages').select('text, sender').order('created_at', { ascending: false }).limit(10);
  console.log('Last 10 Messages:', msgs);
}
run();
