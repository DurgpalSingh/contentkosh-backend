// src/repositories/refreshToken.repo.ts
import { prisma } from '../config/database';

export async function createRefreshToken(userId: number, token: string, expiresAt: Date) {
    return prisma.refreshToken.create({
        data: {
            userId,
            token,
            expiresAt,
        },
    });
}

export async function findByToken(token: string) {
    return prisma.refreshToken.findUnique({
        where: { token },
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    businessId: true,
                    status: true,
                },
            },
        },
    });
}

export async function revokeToken(token: string) {
    return prisma.refreshToken.update({
        where: { token },
        data: { isRevoked: true },
    });
}

export async function revokeAllUserTokens(userId: number) {
    return prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
    });
}

export async function deleteExpiredTokens() {
    return prisma.refreshToken.deleteMany({
        where: {
            OR: [
                { expiresAt: { lt: new Date() } },
                { isRevoked: true },
            ],
        },
    });
}
