import { processIncomingMessage, AIResponse } from './ai-agent';

/**
 * Universal Webhook Handler
 * This function processes messages from any source (WhatsApp, IG, FB)
 */
export const handleIncomingMessage = async (payload: any) => {
  const { sender, text, platform, tenantId } = payload;

  const maskedSender = `***${String(sender).slice(-4)}`;
  console.log(`[MSG] Received ${platform} message from ${maskedSender}`);

  // 2. Process with AI Agent
  const aiResult: AIResponse = await processIncomingMessage(text, tenantId);

  // 3. Log to Database (Supabase)
  // Real logic: Save the incoming and outgoing message to the 'messages' table

  // 4. Send Reply via Platform API
  await sendReply(sender, aiResult.replyMessage, platform);

  return aiResult;
};

/**
 * Sends a message back to the user via Meta Graph API
 */
const sendReply = async (recipient: string, _message: string, platform: string) => {
  const maskedRecipient = `***${String(recipient).slice(-4)}`;
  console.log(`[MSG] Sending reply via ${platform} to ${maskedRecipient}`);
  
  // Implementation for Meta API calls:
  // - WhatsApp Business API endpoint
  // - Instagram Messaging API endpoint
  // - Facebook Messenger API endpoint
};
