import { Response } from 'express';

export enum ApiCode {
    SUCCESS = 'SUCCESS',
    SUCCESS_CREATED = 'SUCCESS_CREATED',
    ERR_GENERIC = 'ERR_GENERIC',
    ERR_NOT_FOUND = 'ERR_NOT_FOUND',
    ERR_BAD_REQUEST = 'ERR_BAD_REQUEST',
    ERR_UNAUTHORIZED = 'ERR_UNAUTHORIZED',
    ERR_FORBIDDEN = 'ERR_FORBIDDEN',
    ERR_SERVER_ERROR = 'ERR_SERVER_ERROR',
}

export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    apiCode: ApiCode;
}
export class ApiResponseHandler {
    static success<T>(res: Response, data?: T, message?: string, statusCode: number = 200): void {
        const response: ApiResponse<T> = {
            success: true,
            ...(message && { message }),
            ...(data && { data }),
            apiCode: ApiCode.SUCCESS
        };
        res.status(statusCode).json(response);
    }

    static created<T>(res: Response, data?: T, message?: string): void {
        const response: ApiResponse<T> = {
            success: true,
            ...(message && { message }),
            ...(data && { data }),
            apiCode: ApiCode.SUCCESS_CREATED
        };
        res.status(201).json(response);
    }

    static successWithExtraProps<T>(res: Response, data?: T, extraProps: Object = {}, message?: string, statusCode: number = 200): void {
        const response: ApiResponse<T> = {
            success: true,
            ...(message && { message }),
            ...(data && { data }),
            ...extraProps,
            apiCode: ApiCode.SUCCESS
        };
        res.status(statusCode).json(response);
    }

    static error(res: Response, message: string, statusCode: number = 400, apiCode: ApiCode = ApiCode.ERR_GENERIC): void {
        const response: ApiResponse = {
            success: false,
            message,
            apiCode
        };
        res.status(statusCode).json(response);
    }

    static notFound(res: Response, message: string = 'Resource not found', apiCode: ApiCode = ApiCode.ERR_NOT_FOUND): void {
        this.error(res, message, 404, apiCode);
    }

    static badRequest(res: Response, message: string, apiCode: ApiCode = ApiCode.ERR_BAD_REQUEST): void {
        this.error(res, message, 400, apiCode);
    }

    static unauthorized(res: Response, message: string = 'Unauthorized', apiCode: ApiCode = ApiCode.ERR_UNAUTHORIZED): void {
        this.error(res, message, 401, apiCode);
    }

    static forbidden(res: Response, message: string = 'Forbidden', apiCode: ApiCode = ApiCode.ERR_FORBIDDEN): void {
        this.error(res, message, 403, apiCode);
    }

    static serverError(res: Response, message: string = 'Internal Server Error', apiCode: ApiCode = ApiCode.ERR_SERVER_ERROR): void {
        this.error(res, message, 500, apiCode);
    }
} 