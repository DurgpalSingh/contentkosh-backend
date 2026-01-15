
import { Request, Response } from 'express';
import { PermissionService } from '../services/permission.service';
import { AssignPermissionDto } from '../dtos/permission.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

const permissionService = new PermissionService();

export class PermissionController {

    async getPermissions(req: Request, res: Response) {
        try {
            let userId = req.query.user_id ? Number(req.query.user_id) : undefined;

            // Fallback to authenticated user if available (assuming generic structure)
            if (!userId && (req as any).user) {
                userId = (req as any).user.id;
            }

            if (!userId) {
                return res.status(400).json({ message: 'User ID is required' });
            }

            const result = await permissionService.getUserPermissions(userId);
            return res.json(result);
        } catch (error: any) {
            return res.status(500).json({ message: error.message });
        }
    }

    async assignPermissions(req: Request, res: Response) {
        try {
            const dto = plainToInstance(AssignPermissionDto, req.body);
            const errors = await validate(dto);

            if (errors.length > 0) {
                return res.status(400).json({ errors });
            }

            if (!dto.permissions || dto.permissions.length === 0) {
                return res.status(400).json({ message: 'Permissions are required' });
            }

            const result = await permissionService.assignPermissions(dto as any);
            return res.json(result);
        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }
    }

    async updatePermissions(req: Request, res: Response) {
        try {
            const dto = plainToInstance(AssignPermissionDto, req.body);
            const errors = await validate(dto);

            if (errors.length > 0) {
                return res.status(400).json({ errors });
            }

            if (!dto.permissions || dto.permissions.length === 0) {
                return res.status(400).json({ message: 'Permissions are required' });
            }

            const result = await permissionService.updatePermissions(dto as any);
            return res.json(result);
        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }
    }

    async deletePermissions(req: Request, res: Response) {
        try {
            // Need to handle body validation manually as DELETE bodies can be tricky in frameworks
            const dto = plainToInstance(AssignPermissionDto, req.body);

            if (!dto.userId) {
                return res.status(400).json({ message: 'User ID is required' });
            }

            if (dto.permissions && dto.permissions.length > 0) {
                const result = await permissionService.deleteSpecificPermissions(dto as any);
                return res.json(result);
            } else {
                await permissionService.deletePermissions(dto.userId);
                return res.json({ message: 'All permissions removed' });
            }
        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }
    }
}
