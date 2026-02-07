export const auditConfig = {
    retentionDays: process.env.AUDIT_RETENTION_DAYS ? parseInt(process.env.AUDIT_RETENTION_DAYS) : 7,
};
