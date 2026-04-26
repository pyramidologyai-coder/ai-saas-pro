export async function sendWhatsAppMessage(to: string, text: string, phoneNumberId: string = '1046139101921254', tenantToken?: string) {
  // Use the tenant token, or fallback to environment/hardcoded
  const token = tenantToken || process.env.META_ACCESS_TOKEN || 'EAAXuONOAqWwBRcZAZC5gZCoXfVmhFuPq1SO03aOKsFAsmMuIl7RIut0ITN63KeTd1qlv7DYqHKztv0Bqx7NU9mEDeDdqbTZBuZAQvZBuKqkCgLo0UZCzzBWKbZCuXveCrImI8GSoYOa0Dus6CM80ZAllO3IXPZChuj0NEZCIVhZAMlesRZBNJpGV3GBvYmJPoX6pIDmyGKXtUMgdwCpNJvGKzaySKMcbjmtzqM5gZAjZAyZAW05d8SXE0Us1S8vxbkCPsDYU3OJ49Ij9vyZCaDR294DbRjrtUMt7VAFIAF71tFZBMZD';
  
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
