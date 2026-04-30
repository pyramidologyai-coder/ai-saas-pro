import crypto from 'crypto';
import { KMS } from './kms';

/**
 * 2126 Cyber Security: Tenant-Isolated Cryptography & Key Rotation Policy
 */

const ALGORITHM = 'aes-256-gcm';

export class TenantCrypto {
    // Rotation Policy: Keep older versions for fallback decryption (Lazy Rotation)
    private static async getMasterKey(version: 'v1' | 'v2' = 'v2'): Promise<Buffer> {
        const keyName = version === 'v1' ? 'STRIPE_SECRET_KEY_V1' : 'STRIPE_SECRET_KEY';
        let secret;
        try {
            secret = await KMS.getSecret(keyName);
        } catch (e) {
            // Fallback to V2 if V1 is requested but doesn't exist during initial deployment
            secret = await KMS.getSecret('STRIPE_SECRET_KEY');
        }
        return crypto.createHash('sha256').update(secret).digest();
    }

    static async encrypt(text: string, tenantId: string): Promise<string> {
        if (!text) return text;
        const masterKey = await this.getMasterKey('v2'); // Always encrypt with the newest key
        
        const ivHash = crypto.createHash('md5').update(tenantId).digest('hex');
        const iv = Buffer.from(ivHash.substring(0, 24), 'hex');
        
        const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        
        // Append Key Version to the ciphertext (v2)
        return `v2:${iv.toString('hex')}:${authTag}:${encrypted}`;
    }

    static async decrypt(encryptedData: string, tenantId: string): Promise<string> {
        if (!encryptedData || !encryptedData.includes(':')) return encryptedData;
        
        try {
            const parts = encryptedData.split(':');
            let version = 'v1';
            let ivStr, authTagStr, encryptedText;

            // Handle Key Versioning
            if (parts[0] === 'v2') {
                version = 'v2';
                ivStr = parts[1];
                authTagStr = parts[2];
                encryptedText = parts[3];
            } else if (parts.length === 3) {
                // Legacy unversioned tokens act as v1
                ivStr = parts[0];
                authTagStr = parts[1];
                encryptedText = parts[2];
            } else {
                return encryptedData;
            }
            
            const iv = Buffer.from(ivStr, 'hex');
            const authTag = Buffer.from(authTagStr, 'hex');
            
            const expectedIvHash = crypto.createHash('md5').update(tenantId).digest('hex');
            const expectedIv = Buffer.from(expectedIvHash.substring(0, 24), 'hex');
            
            if (!iv.equals(expectedIv)) {
                throw new Error('Security Violation: BOLA Attempt Detected. Tenant ID mismatch.');
            }

            const masterKey = await this.getMasterKey(version as 'v1' | 'v2');
            const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
            decipher.setAuthTag(authTag);
            
            let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            // Audit Log: Record Decryption Event (Fire and Forget to avoid DB locking)
            this.logDecryptionEvent(tenantId);

            return decrypted;
        } catch (error) {
            console.error('[CRYPTO DECRYPTION FAILED]', error);
            throw new Error('Failed to decrypt sensitive data');
        }
    }

    private static logDecryptionEvent(tenantId: string) {
        // In a hyper-scale 2126 system, this goes to AWS Kinesis/CloudWatch or an async queue
        // We log the fact that a sensitive token was accessed in memory.
        console.log(`[AUDIT_LOG] Meta Token decrypted in memory for Tenant: ${tenantId} at ${new Date().toISOString()}`);
    }
}
