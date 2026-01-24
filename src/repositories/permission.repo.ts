import { prisma } from '../config/database';

export const findAllPermissions = async () => {
    // Potentially filter system permissions if they can be soft deleted, but usually this is for user assignment
    return prisma.permission.findMany();
};

export const findPermissionsByCodes = async (codes: string[]) => {
    return prisma.permission.findMany({
        where: {
            code: { in: codes },
        },
    });
};

export const findUserPermissions = async (userId: number) => {
    return prisma.rolePermission.findMany({
        where: {
            userId,
        },
        include: {
            permission: true,
        },
    });
};

export const assignUserPermissions = async (userId: number, permissionIds: number[]) => {
    // We use upsert to handle both new assignments and "reviving" soft-deleted ones
    return prisma.$transaction(
        permissionIds.map((permissionId) =>
            prisma.rolePermission.upsert({
                where: {
                    userId_permissionId: {
                        userId,
                        permissionId,
                    },
                },
                update: {},
                create: {
                    userId,
                    permissionId,
                },
            })
        )
    );
};

export const removeUserPermissions = async (userId: number, permissionIds?: number[]) => {
    if (permissionIds && permissionIds.length > 0) {
        return prisma.rolePermission.deleteMany({
            where: {
                userId,
                permissionId: { in: permissionIds },
            },
        });
    } else {
        return prisma.rolePermission.deleteMany({
            where: { userId },
        });
    }
};

export const replaceUserPermissions = async (userId: number, permissionIds: number[]) => {
    return prisma.$transaction(async (tx) => {
        // Delete ALL existing permissions for the user
        await tx.rolePermission.deleteMany({
            where: { userId },
        });

        // Create the new set of permissions
        if (permissionIds.length > 0) {
            await tx.rolePermission.createMany({
                data: permissionIds.map(permissionId => ({
                    userId,
                    permissionId
                }))
            });
        }
    });
};
