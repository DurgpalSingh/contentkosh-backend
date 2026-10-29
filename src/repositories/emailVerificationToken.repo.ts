// src/repositories/emailVerificationToken.repo.ts
// Always use publicPrisma: email_verification_tokens live in the public schema and must never
// be routed to a tenant schema regardless of the active request context.
import { Prisma } from '@prisma/client';
import { publicPrisma as prisma } from '../config/database';

export interface UpsertVerificationTokenData {
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  /** Business details held until the link is opened; `null` for guest signups. */
  pendingBusiness?: Prisma.InputJsonValue | null;
}

/** One row per user: re-issuing overwrites the hash, which invalidates the previously emailed link. */
export async function upsertForUser(data: UpsertVerificationTokenData) {
  const now = new Date();
  const pendingBusiness =
    data.pendingBusiness === undefined ? undefined : data.pendingBusiness === null ? Prisma.DbNull : data.pendingBusiness;

  return prisma.emailVerificationToken.upsert({
    where: { userId: data.userId },
    create: {
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      lastSentAt: now,
      ...(pendingBusiness !== undefined && { pendingBusiness }),
    },
    update: {
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      lastSentAt: now,
      verifiedAt: null,
      ...(pendingBusiness !== undefined && { pendingBusiness }),
    },
  });
}

export async function findByTokenHash(tokenHash: string) {
  return prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: { id: true, email: true, name: true, role: true, businessId: true, status: true, emailVerified: true },
      },
    },
  });
}

export async function findByUserId(userId: number) {
  return prisma.emailVerificationToken.findUnique({ where: { userId } });
}

export async function markVerified(userId: number) {
  return prisma.emailVerificationToken.update({
    where: { userId },
    data: { verifiedAt: new Date(), pendingBusiness: Prisma.DbNull },
  });
}
