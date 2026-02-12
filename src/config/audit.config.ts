export const auditConfig = {
    retentionDays: process.env.AUDIT_RETENTION_DAYS ? parseInt(process.env.AUDIT_RETENTION_DAYS) : 7,
    cleanupSchedule: process.env.AUDIT_CLEANUP_SCHEDULE || '0 0 * * *',
};
