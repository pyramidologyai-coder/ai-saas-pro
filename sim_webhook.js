async function simulate() {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1046139101921254", // Account ID
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15551234567",
                phone_number_id: "1046139101921254" // This must match a tenant in DB
              },
              contacts: [
                {
                  profile: {
                    name: "مريض تجريبي"
                  },
                  wa_id: "201115351111" // Patient phone number
                }
              ],
              messages: [
                {
                  from: "201115351111", // Patient phone number
                  id: "wamid.HBgMMjAxMTE1MzUxMTExFQIAEhgUM0VCMDNGOT...",
                  timestamp: "1714249000",
                  text: {
                    body: "عايز احجز كشف بكره"
                  },
                  type: "text"
                }
              ]
            },
            field: "messages"
          }
        ]
      }
    ]
  };

  try {
    const res = await fetch('http://localhost:3000/api/webhooks/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", data);
  } catch(e) {
    console.error("Error:", e);
  }
}

simulate();
