async function run() {
  const payload = {
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "metadata": {
            "phone_number_id": "1046139101921254"
          },
          "messages": [{
            "from": "201115351111",
            "type": "text",
            "text": { "body": "ازيك عامل ايه 123" }
          }]
        }
      }]
    }]
  };

  console.log('Sending webhook...');
  const start = Date.now();
  const res = await fetch('https://reportclinics.vercel.app/api/webhooks/meta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const text = await res.text();
  console.log('Took:', (Date.now() - start)/1000, 'seconds');
  console.log('Status:', res.status);
  console.log('Response:', text);
}

run();
