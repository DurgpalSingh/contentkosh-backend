import { auditConfig } from '../config/audit.config';
import { auditRepo } from '../repositories/audit.repo';
import logger from '../utils/logger';

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
            const config = await auditRepo.findSystemConfig(AUDIT_ENABLED_KEY);

            isEnabledCache = config ? config.value === 'true' : true; // Default to true if not set? Or false? Let's default to true.
            lastCacheUpdate = now;
            return isEnabledCache;
        } catch (error) {
            logger.error(`Error checking audit status: ${error}`);
            return true;
        }
    },

    /**
     * Enable or disable auditing.
     */
    async setAuditingEnabled(enabled: boolean): Promise<void> {
        logger.info(`Setting audit enabled to: ${enabled}`);
        const value = String(enabled);

        try {
            await auditRepo.upsertSystemConfig(AUDIT_ENABLED_KEY, value);

            isEnabledCache = enabled;
            lastCacheUpdate = Date.now();
            logger.info('Audit status updated successfully');
        } catch (error) {
            logger.error(`Error setting audit status: ${error}`);
            throw error;
        }
    },

    /**
     * Delete audit logs older than configured retention period.
     */
    async cleanupOldAudits(): Promise<number> {
        const retentionDays = auditConfig.retentionDays;
        logger.info(`Cleaning up audit logs older than ${retentionDays} days`);

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        try {
            const result = await auditRepo.deleteOldAuditLogs(cutoffDate);
            logger.info(`Deleted ${result.count} old audit logs`);
            return result.count;
        } catch (error) {
            logger.error(`Error cleaning up old audits: ${error}`);
            throw error;
        }
    }
};
