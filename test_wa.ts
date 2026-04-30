import { sendWhatsAppMessage } from './src/lib/whatsapp';

async function run() {
  console.log('Sending message to WhatsApp...');
  try {
    const res = await sendWhatsAppMessage('201115351111', 'رسالة تجريبية من السيرفر', '1046139101921254', 'EAAXuONOAqWwBRSBFGfUMBQZAnijxc9vyWnjDgnHKlx3IfPez8BfPph2l0X1xknmoIxZAyZBz7Hxesk7kpPxNtod9nsWYLL64piwvBZBHQ7TC4ZAavwopaRHBaC4Gj821h2APjXYmFKYmsj9ZBxHJngkIWKRZBi97G3S9iKc5w34ZBQlkt7SrQIfSz0sJ9uzSov2KQPEZAhZBnNwdWMyKQwGdTZAi2mUSZAiSHkKZCQsqtkjGENNBB06MopWZC9iuEKdnqYOs0BeAvRBm0UYO9Mc0Iqv6Sbcu4PSlBZAuVkZD');
    console.log('WA Response:', res);
  } catch (error) {
    console.error('Error:', error);
  }
}

run();
