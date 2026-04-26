const token = 'EAAVaE7rxxeABRWQBmfuuVdiynEYEaeXXfn9JiosEm6HDV0u5qBaKNBOUygRfPJdKsU3GWjN9T8CYgaYYXYQ2ZBYrjGYnIZB7tZCnveVZBJocvTOVTciTUabCV0Wb1ZCWflmXPemMxTKuZBPi7glGiw7pZBQZBjalC6KlPINI3lQgCF8ZAV0pFOiKvcYxGQpXQqEsPuDq5gUep8Walv7ZCslywvNzCxHHy7AIyL6grrn1z7BCbHBIQK6BEpbGhaQze7zAMPGYBu5rP3Lp4ZCpUOU1k2jsjbCCzKhCieiv6Lb';
const phoneNumberId = '1046139101921254';
const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messaging_product: 'whatsapp',
    to: '201113977710',
    type: 'text',
    text: { body: 'Testing from the server directly!' },
  }),
}).then(res => res.json()).then(console.log).catch(console.error);
