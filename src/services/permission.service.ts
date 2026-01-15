
import { PrismaClient } from '@prisma/client';
import { AssignPermissionDto } from '../dtos/permission.dto';

const prisma = new PrismaClient();

export class PermissionService {
    async getAllPermissions() {
        return prisma.permission.findMany();
    }

    async getUserPermissions(userId: number) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                role: true,
                rolePermissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });

        if (!user) {
            throw new Error('User not found');
        }

        return {
            user: {
                id: user.id,
                role: user.role,
            },
            permissions: user.rolePermissions.map((rp) => rp.permission.code),
        };
    }

    async assignPermissions(dto: AssignPermissionDto) {
        const { userId, permissions = [] } = dto;

        // Verify user exists
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }

        // Get permission IDs for the codes
        const permissionRecords = await prisma.permission.findMany({
            where: {
                code: { in: permissions },
            },
        });

        if (permissionRecords.length !== permissions.length) {
            throw new Error('Some permissions are invalid');
        }

        // Transaction to update permissions
        return await prisma.$transaction(async (tx) => {
            // Find existing permissions to avoid duplicates
            const existing = await tx.rolePermission.findMany({
                where: {
                    userId: userId,
                    permissionId: { in: permissionRecords.map(p => p.id) }
                }
            });

            const existingIds = new Set(existing.map(e => e.permissionId));
            const newPermissions = permissionRecords.filter(p => !existingIds.has(p.id));

            if (newPermissions.length > 0) {
                await tx.rolePermission.createMany({
                    data: newPermissions.map((p) => ({
                        userId,
                        permissionId: p.id,
                    })),
                });
            }

            return this.getUserPermissions(userId);
        });
    }

    async updatePermissions(dto: AssignPermissionDto) {
        const { userId, permissions = [] } = dto;
        // Verify user exists
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }

        // Get permission IDs for the codes
        const permissionRecords = await prisma.permission.findMany({
            where: {
                code: { in: permissions },
            },
        });

        if (permissionRecords.length !== permissions.length) {
            throw new Error('Some permissions are invalid');
        }

        return await prisma.$transaction(async (tx) => {
            // generic update: delete all and re-insert? Or diff?
            // "PUT" usually implies replacement.
            await tx.rolePermission.deleteMany({
                where: { userId }
            });

            await tx.rolePermission.createMany({
                data: permissionRecords.map(p => ({
                    userId,
                    permissionId: p.id
                }))
            });

            return this.getUserPermissions(userId);
        });
    }

    async deletePermissions(userId: number) {
        // Request says "Delete /permission", implies clearing for a user?
        // Or deleting specific permissions? Payload structure for delete wasn't specified separately but implied same payload structure?
        // "Create all APIs... Delete /permission... Request payload { user_id, permissions }"
        // If payload is sent with Delete, it implies removing specific permissions.

        return await prisma.rolePermission.deleteMany({
            where: { userId }
        });
    }

    async deleteSpecificPermissions(dto: AssignPermissionDto) {
        const { userId, permissions = [] } = dto;

        const permissionRecords = await prisma.permission.findMany({
            where: { code: { in: permissions } }
        });

        const idsToDelete = permissionRecords.map(p => p.id);

        await prisma.rolePermission.deleteMany({
            where: {
                userId,
                permissionId: { in: idsToDelete }
            }
        });

        return this.getUserPermissions(userId);
    }
}
