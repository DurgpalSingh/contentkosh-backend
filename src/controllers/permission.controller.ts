
import { Request, Response } from 'express';
import { PermissionService } from '../services/permission.service';
import { AssignPermissionDto } from '../dtos/permission.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ApiResponseHandler } from '../utils/apiResponse';
import { BadRequestError } from '../errors/api.errors';
import { handleControllerError } from '../utils/controllerErrorHandler';

const permissionService = new PermissionService();

export interface AuthenticatedRequest extends Request {
    user?: {
        id: number;
        role: string;
        [key: string]: any;
    };
}

export class PermissionController {

    async getPermissions(req: Request, res: Response) {
        try {
            let userId = req.query.user_id ? Number(req.query.user_id) : undefined;

            // Fallback to authenticated user if available
            const authReq = req as AuthenticatedRequest;
            if (!userId && authReq.user) {
                userId = authReq.user.id;
            }

            if (!userId) {
                throw new BadRequestError('User ID is required');
            }

            const result = await permissionService.getUserPermissions(userId);
            return ApiResponseHandler.success(res, result);
        } catch (error) {
            handleControllerError(res, error, 'Internal Server Error', 'Permission controller error');
        }
    }

    async getAllSystemPermissions(req: Request, res: Response) {
        try {
            const result = await permissionService.getAllPermissions();
            return ApiResponseHandler.success(res, result);
        } catch (error) {
            handleControllerError(res, error, 'Internal Server Error', 'Permission controller error');
        }
    }

    async assignPermissions(req: Request, res: Response) {
        try {
            const dto = plainToInstance(AssignPermissionDto, req.body);
            const errors = await validate(dto);

            if (errors.length > 0) {
                // Construct a detailed validation error message
                const msg = errors.map(e => Object.values(e.constraints || {}).join(', ')).join('; ');
                throw new BadRequestError(msg);
            }

            if (!dto.permissions || dto.permissions.length === 0) {
                throw new BadRequestError('Permissions are required');
            }

            const result = await permissionService.assignPermissions(dto);
            return ApiResponseHandler.success(res, result);
        } catch (error) {
            handleControllerError(res, error, 'Internal Server Error', 'Permission controller error');
        }
    }

    async updatePermissions(req: Request, res: Response) {
        try {
            const dto = plainToInstance(AssignPermissionDto, req.body);
            const errors = await validate(dto);

            if (errors.length > 0) {
                const msg = errors.map(e => Object.values(e.constraints || {}).join(', ')).join('; ');
                throw new BadRequestError(msg);
            }

            if (!dto.permissions || dto.permissions.length === 0) {
                throw new BadRequestError('Permissions are required');
            }

            const result = await permissionService.updatePermissions(dto);
            return ApiResponseHandler.success(res, result);
        } catch (error) {
            handleControllerError(res, error, 'Internal Server Error', 'Permission controller error');
        }
    }

    async deletePermissions(req: Request, res: Response) {
        try {
            // NOTE: We are using req.body in a DELETE request to support deleting specific permissions.
            // Ensure the client sends the payload correctly.
            const dto = plainToInstance(AssignPermissionDto, req.body);

            if (!dto.userId) {
                throw new BadRequestError('User ID is required');
            }

            const result = await permissionService.handlePermissionDeletion(dto);
            return ApiResponseHandler.success(res, result);
        } catch (error) {
            handleControllerError(res, error, 'Internal Server Error', 'Permission controller error');
        }
    }
}
