import { prisma } from '../config/database';

export const auditRepo = {
    async findSystemConfig(key: string) {
        // @ts-ignore - SystemConfig might not be generated yet in client types
        return prisma.systemConfig.findUnique({
            where: { key },
        });
    },

    async upsertSystemConfig(key: string, value: string) {
        // @ts-ignore
        return prisma.systemConfig.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });
    },

    async deleteOldAuditLogs(cutoffDate: Date) {
        // @ts-ignore
        return prisma.apiAuditLog.deleteMany({
            where: {
                createdAt: {
                    lt: cutoffDate,
                },
            },
        });
    }
};
