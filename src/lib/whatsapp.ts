export async function sendWhatsAppMessage(to: string, text: string, phoneNumberId: string, tenantToken?: string) {
  const token = tenantToken || process.env.META_ACCESS_TOKEN;
  if (!token) {
    throw new Error('No WhatsApp access token provided. Set META_ACCESS_TOKEN or pass tenantToken.');
  }
  if (!phoneNumberId) {
    throw new Error('phoneNumberId is required to send a WhatsApp message.');
  }
  
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Meta API Error:', data);
    }
    return data;
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error);
    throw error;
  }
}

export async function sendWhatsAppTemplate(
  to: string, 
  templateName: string, 
  parameters: string[] = [], 
  phoneNumberId: string, 
  tenantToken: string
) {
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  const components = parameters.length > 0 ? [
    {
      type: "body",
      parameters: parameters.map(param => ({
        type: "text",
        text: param
      }))
    }
  ] : [];

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tenantToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'ar' },
          components: components
        }
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Meta Template API Error:', data);
    }
    return data;
  } catch (error) {
    console.error('Failed to send WhatsApp template:', error);
    throw error;
  }
}
