/**
 * 2126 Cyber Security: Strict Rate Limiting Engine
 * Prevents Brute Force and DoS attacks at the Agency level.
 */

// In-Memory map for edge environments. (Use Redis in multi-node clusters).
const agencyRateLimitMap = new Map<string, { count: number, resetTime: number }>();

export class AgencyRateLimiter {
    /**
     * Checks if the agency has exceeded their request limit.
     * @param agencyId The Agency ID
     * @param limit Max requests per window
     * @param windowMs Time window in milliseconds (default 60s)
     * @returns boolean - True if allowed, false if blocked.
     */
    static check(agencyId: string, limit: number = 30, windowMs: number = 60000): boolean {
        if (!agencyId) return false;
        
        const now = Date.now();
        const data = agencyRateLimitMap.get(agencyId);
        
        if (data && data.resetTime > now) {
            if (data.count >= limit) {
                console.warn(`[RATE LIMIT EXCEEDED] Agency ${agencyId} blocked for suspicious volume.`);
                return false; 
            }
            data.count++;
        } else {
            // Reset window
            agencyRateLimitMap.set(agencyId, { count: 1, resetTime: now + windowMs });
        }
        return true;
    }
}

// Separate map for external API endpoints (per tenant)
const tenantRateLimitMap = new Map<string, { count: number, resetTime: number }>();

export class TenantRateLimiter {
    static check(tenantId: string, limit: number = 60, windowMs: number = 60000): boolean {
        if (!tenantId) return false;
        
        const now = Date.now();
        const data = tenantRateLimitMap.get(tenantId);
        
        if (data && data.resetTime > now) {
            if (data.count >= limit) {
                console.warn(`[RATE LIMIT EXCEEDED] Tenant API ${tenantId} blocked.`);
                return false; 
            }
            data.count++;
        } else {
            tenantRateLimitMap.set(tenantId, { count: 1, resetTime: now + windowMs });
        }
        return true;
    }
}
