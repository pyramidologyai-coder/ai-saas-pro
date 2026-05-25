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

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function inspect() {
  console.log("1. Checking total message count:");
  const { count: msgCount, error: msgCountErr } = await supabase.from('chat_messages').select('*', { count: 'exact', head: true });
  console.log("Total messages in chat_messages:", msgCount, msgCountErr ? msgCountErr.message : '');

  console.log("2. Checking distinct channels and senders in chat_messages:");
  const { data: channelsData, error: channelsErr } = await supabase.from('chat_messages').select('channel, sender').limit(100);
  if (channelsErr) {
    console.error("Error reading chat_messages:", channelsErr);
  } else {
    const channels = new Set(channelsData.map(m => m.channel));
    const senders = new Set(channelsData.map(m => m.sender));
    console.log("Distinct channels found in sample:", Array.from(channels));
    console.log("Distinct senders found in sample:", Array.from(senders));
  }

  console.log("3. Checking conversations:");
  const { data: convData, error: convErr } = await supabase.from('conversations').select('*').limit(2);
  console.log("Sample conversation data:", convData, convErr ? convErr.message : '');
}

inspect();
