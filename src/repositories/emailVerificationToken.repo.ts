import { UserStatus } from '@prisma/client';
import { publicPrisma as prisma } from '../config/database';

export interface VerificationTokenData {
  businessId: number;
  tokenHash: string;
  expiresAt: Date;
}

/** One row per user: re-issuing overwrites the hash, which invalidates the previously emailed link. */
export function upsertForUser(userId: number, data: VerificationTokenData) {
  return prisma.emailVerificationToken.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

export function findByTokenHash(tokenHash: string) {
  return prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: {
      business: true,
      user: { select: { id: true, name: true, email: true, emailVerified: true } },
    },
  });
}

export function findUnverifiedByEmail(email: string) {
  return prisma.emailVerificationToken.findMany({
    where: { user: { email: email.toLowerCase().trim(), emailVerified: false, status: UserStatus.ACTIVE } },
    select: {
      expiresAt: true,
      business: { select: { id: true, instituteName: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
}
