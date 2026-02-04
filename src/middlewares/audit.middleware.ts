import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const apiAuditLogger = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const originalSend = res.send;
    const originalJson = res.json;

    let responseBody: any;

    res.send = function (body) {
        responseBody = body;
        return originalSend.apply(res, arguments as any);
    };

    res.json = function (body) {
        responseBody = body;
        return originalJson.apply(res, arguments as any);
    };

    res.on('finish', async () => {
        const duration = Date.now() - start;

        // Extract user info if available (assuming populated by auth middleware)
        const userId = (req as any).user?.id || null;
        const role = (req as any).user?.role || null;

        try {
            await (prisma as any).apiAuditLog.create({
                data: {
                    userId: userId,
                    role: role,
                    httpMethod: req.method,
                    requestUrl: req.originalUrl || req.url,
                    requestPath: req.path,
                    queryParams: req.query as any,
                    requestBody: req.body as any,
                    responseStatus: res.statusCode,
                    responseTimeMs: duration,
                    responseBody: responseBody ? JSON.parse(JSON.stringify(responseBody)) : undefined, // Ensure it's JSON compatible
                    // Basic error capturing if present in response body or status code
                    errorCode: res.statusCode >= 400 ? String(res.statusCode) : undefined,
                    errorMessage: res.statusCode >= 400 && responseBody?.message ? responseBody.message : undefined,
                },
            });
        } catch (error) {
            console.error('Failed to log API audit:', error);
        }
    });

    next();
};
