/**
 * 2126 Cyber Security: WhatsApp Background Queue
 * Decouples message sending from the main API thread to prevent blocking under high load.
 * 
 * Uses Redis (BullMQ pattern) for production or falls back to async background execution for Edge environments.
 */

import { sendWhatsAppMessage } from './whatsapp';
import { TenantCrypto } from './crypto';

// In a real 2126 production environment, this would import 'bullmq' and 'ioredis'.
// For Next.js Edge/Serverless compatibility without a dedicated Redis cluster attached yet, 
// we simulate an async queue mechanism.

export class WhatsAppQueue {
    /**
     * Adds a message to the sending queue.
     * @param from The recipient phone number
     * @param text The message text
     * @param phoneNumberId The Meta Phone ID
     * @param encryptedMetaToken The encrypted token (will be decrypted in the worker)
     * @param tenantId The Tenant ID
     */
    static async enqueue(from: string, text: string, phoneNumberId: string, encryptedMetaToken: string, tenantId: string) {
        // Enqueue process:
        // 1. Send to Redis (e.g., bullQueue.add('send_msg', { ...data }))
        // 2. A separate worker process picks it up.

        // Fallback for Vercel Serverless environment:
        // We use a non-blocking asynchronous execution (Fire and Forget)
        
        console.log(`[QUEUE] Enqueued message to ${from} for tenant ${tenantId}.`);

        // Execute in background so the webhook HTTP response returns immediately
        setTimeout(async () => {
            try {
                // Decrypt token securely inside the worker
                const decryptedToken = await TenantCrypto.decrypt(encryptedMetaToken, tenantId);
                
                await sendWhatsAppMessage(from, text, phoneNumberId, decryptedToken);
                console.log(`[QUEUE_WORKER] Successfully processed message to ${from}`);
            } catch (error) {
                console.error(`[QUEUE_WORKER_ERROR] Failed to send message to ${from}:`, error);
                // In Redis/BullMQ, this would trigger a retry policy.
            }
        }, 0);
    }
}
