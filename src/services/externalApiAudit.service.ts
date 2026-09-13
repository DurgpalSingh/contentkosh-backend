import { Prisma } from '@prisma/client';
import { externalApiAuditRepo } from '../repositories/externalApiAudit.repo';
import { requestContext } from '../contexts/request-context';
import { ExternalApiServiceName } from '../constants/externalApiAudit.constants';
import logger from '../utils/logger';

export interface LogExternalApiCallParams {
  serviceName: ExternalApiServiceName;
  httpMethod: string;
  requestUrl: string;
  requestPath: string;
  requestBody?: unknown;
  responseStatus?: number | undefined;
  responseTimeMs: number;
  responseBody?: unknown;
  isSuccess: boolean;
  errorCode?: string | undefined;
  errorMessage?: string | undefined;
}

export const externalApiAuditService = {
  /**
   * Records one outbound call to an external service. Never throws - a logging
   * failure must never take down the caller's actual external API request.
   */
  async logExternalApiCall(params: LogExternalApiCallParams): Promise<void> {
    const user = requestContext.getOptionalUser();

    try {
      await externalApiAuditRepo.create({
        serviceName: params.serviceName,
        businessId: user?.businessId ?? null,
        userId: user?.id ?? null,
        role: user?.role ?? null,
        httpMethod: params.httpMethod,
        requestUrl: params.requestUrl,
        requestPath: params.requestPath,
        requestBody: params.requestBody as Prisma.InputJsonValue | undefined,
        responseStatus: params.responseStatus ?? null,
        responseTimeMs: params.responseTimeMs,
        responseBody: params.responseBody as Prisma.InputJsonValue | undefined,
        isSuccess: params.isSuccess,
        errorCode: params.errorCode ?? null,
        errorMessage: params.errorMessage ?? null,
      });
    } catch (error) {
      logger.error(`Failed to log external API audit for ${params.serviceName}: ${error}`);
    }
  },

  /**
   * Deletes external API audit logs older than `retentionDays`. Mirrors the
   * existing ApiAuditLog cleanup in audit.service.ts.
   */
  async cleanupOldExternalApiAudits(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const result = await externalApiAuditRepo.deleteOldLogs(cutoffDate);
      logger.info(`Deleted ${result.count} old external API audit logs`);
      return result.count;
    } catch (error) {
      logger.error(`Error cleaning up old external API audit logs: ${error}`);
      throw error;
    }
  },
};
