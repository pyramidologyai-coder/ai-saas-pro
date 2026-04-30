// 2126 Cyber Security KMS (Key Management Service) Module
// Protocol: Atomic Operations & Zero Trust
import crypto from 'crypto';

export class KMS {
    // Advanced Encryption Standard (AES-256-GCM) for Database Column Encryption
    // The key must be exactly 32 bytes (256 bits). We pull this from Vercel process.env
    private static getEncryptionKey(): Buffer {
        const key = process.env.DATABASE_ENCRYPTION_KEY;
        if (!key || key.length !== 32) {
            console.error('[FATAL] DATABASE_ENCRYPTION_KEY must be exactly 32 bytes.');
            // For development fallback (NEVER IN PROD)
            return crypto.createHash('sha256').update('dummy-fallback-key-do-not-use-in-prod').digest();
        }
        return Buffer.from(key, 'utf-8');
    }

    /**
     * Encrypts a plaintext string (like a WhatsApp Token) into AES-256-GCM.
     * Returns a base64 string combining the IV, AuthTag, and Ciphertext.
     */
    static encrypt(text: string): string {
        if (!text) return text;
        const iv = crypto.randomBytes(12); // 96-bit IV for GCM
        const cipher = crypto.createCipheriv('aes-256-gcm', this.getEncryptionKey(), iv);
        
        let encrypted = cipher.update(text, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        const authTag = cipher.getAuthTag().toString('base64');
        
        // Format: IV:AuthTag:Ciphertext
        return `${iv.toString('base64')}:${authTag}:${encrypted}`;
    }

    /**
     * Decrypts an AES-256-GCM encrypted string back to plaintext.
     */
    static decrypt(encryptedData: string): string {
        if (!encryptedData || !encryptedData.includes(':')) return encryptedData; // Assume it's not encrypted yet
        
        const parts = encryptedData.split(':');
        if (parts.length !== 3) throw new Error('Invalid encrypted payload format.');
        
        const [ivBase64, authTagBase64, ciphertext] = parts;
        const iv = Buffer.from(ivBase64, 'base64');
        const authTag = Buffer.from(authTagBase64, 'base64');
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.getEncryptionKey(), iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    /**
     * Securely retrieves a master secret key from the environment.
     */
    static async getSecret(keyName: string): Promise<string> {
        if (typeof window !== 'undefined') {
            throw new Error("Security Violation: KMS cannot be accessed from client environments.");
        }

        const secret = process.env[keyName];
        if (!secret) {
            console.error(`[KMS ALERT] Required key ${keyName} is missing.`);
            throw new Error(`KMS: Retrieval failed for ${keyName}`);
        }

        return secret;
    }
}
