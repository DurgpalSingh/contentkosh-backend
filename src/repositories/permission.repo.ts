import { prisma } from '../config/database';

export const findAllPermissions = async () => {
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
        where: { userId },
        include: {
            permission: true,
        },
    });
};

export const assignUserPermissions = async (userId: number, permissionIds: number[]) => {
    const data = permissionIds.map((permissionId) => ({
        userId,
        permissionId,
    }));

    return prisma.rolePermission.createMany({
        data,
        skipDuplicates: true,
    });
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
        // Delete all existing permissions for the user
        await tx.rolePermission.deleteMany({
            where: { userId },
        });

        // Insert new permissions
        if (permissionIds.length > 0) {
            await tx.rolePermission.createMany({
                data: permissionIds.map((permissionId) => ({
                    userId,
                    permissionId,
                })),
            });
        }
    });
};
