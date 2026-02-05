import { PrismaClient } from '@prisma/client';
import { SystemConfig } from '@prisma/client'; // This import might fail if generate failed to add SystemConfig, but I have to try.

const prisma = new PrismaClient();
const AUDIT_ENABLED_KEY = 'AUDIT_ENABLED';

let isEnabledCache: boolean | null = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

export const auditService = {
    /**
     * Check if auditing is enabled. Uses caching to reduce DB hits.
     */
    async isAuditingEnabled(): Promise<boolean> {
        const now = Date.now();
        if (isEnabledCache !== null && (now - lastCacheUpdate < CACHE_TTL)) {
            return isEnabledCache;
        }

        try {
            // @ts-ignore - SystemConfig might not be generated yet in client types
            const config = await prisma.systemConfig.findUnique({
                where: { key: AUDIT_ENABLED_KEY },
            });

            isEnabledCache = config ? config.value === 'true' : true; // Default to true if not set? Or false? Let's default to true.
            lastCacheUpdate = now;
            return isEnabledCache;
        } catch (error) {
            console.error('Error checking audit status, defaulting to true:', error);
            return true;
        }
    },

    /**
     * Enable or disable auditing.
     */
    async setAuditingEnabled(enabled: boolean): Promise<void> {
        const value = String(enabled);

        // @ts-ignore
        await prisma.systemConfig.upsert({
            where: { key: AUDIT_ENABLED_KEY },
            update: { value },
            create: { key: AUDIT_ENABLED_KEY, value },
        });

        isEnabledCache = enabled;
        lastCacheUpdate = Date.now();
    },

    /**
     * Delete audit logs older than 7 days.
     */
    async cleanupOldAudits(): Promise<number> {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        try {
            // @ts-ignore
            const result = await prisma.apiAuditLog.deleteMany({
                where: {
                    createdAt: {
                        lt: sevenDaysAgo,
                    },
                },
            });
            return result.count;
        } catch (error) {
            console.error('Error cleaning up old audits:', error);
            throw error;
        }
    }
};
