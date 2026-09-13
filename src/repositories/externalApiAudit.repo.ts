import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export interface CreateExternalApiAuditLogData {
  serviceName: string;
  businessId?: number | null | undefined;
  userId?: number | null | undefined;
  role?: string | null | undefined;
  httpMethod: string;
  requestUrl: string;
  requestPath: string;
  requestBody?: Prisma.InputJsonValue | undefined;
  responseStatus?: number | null | undefined;
  responseTimeMs: number;
  responseBody?: Prisma.InputJsonValue | undefined;
  isSuccess: boolean;
  errorCode?: string | null | undefined;
  errorMessage?: string | null | undefined;
}

export const externalApiAuditRepo = {
  create(data: CreateExternalApiAuditLogData) {
    return prisma.externalApiAuditLog.create({
      data: {
        serviceName: data.serviceName,
        businessId: data.businessId ?? null,
        userId: data.userId ?? null,
        role: data.role ?? null,
        httpMethod: data.httpMethod,
        requestUrl: data.requestUrl,
        requestPath: data.requestPath,
        ...(data.requestBody !== undefined ? { requestBody: data.requestBody } : {}),
        responseStatus: data.responseStatus ?? null,
        responseTimeMs: data.responseTimeMs,
        ...(data.responseBody !== undefined ? { responseBody: data.responseBody } : {}),
        isSuccess: data.isSuccess,
        errorCode: data.errorCode ?? null,
        errorMessage: data.errorMessage ?? null,
      },
    });
  },

  deleteOldLogs(cutoffDate: Date) {
    return prisma.externalApiAuditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });
  },
};
