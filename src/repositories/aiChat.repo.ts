import { AIChat, AIChatStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export interface CreateAIChatInput {
  userId: number;
  businessId: number;
  userMessage: string;
  assistantResponse: string;
  source: Prisma.InputJsonValue | null;
}

export async function createAIChat(data: CreateAIChatInput): Promise<AIChat> {
  const { source, ...rest } = data;
  return prisma.aIChat.create({
    data: {
      ...rest,
      source: source ?? Prisma.JsonNull,
    },
  });
}

export async function createPendingAIChat(data: {
  userId: number;
  businessId: number;
  userMessage: string;
}): Promise<AIChat> {
  return prisma.aIChat.create({
    data: { ...data, status: AIChatStatus.PENDING },
  });
}

export async function findPendingAIChatByUser(userId: number, businessId: number): Promise<AIChat | null> {
  return prisma.aIChat.findFirst({
    where: { userId, businessId, status: AIChatStatus.PENDING },
    orderBy: { createdAt: 'desc' },
  });
}

// Scoped to PENDING so a chat deleted (cancelled) mid-flight is silently skipped (count 0).
export async function completePendingAIChat(
  id: number,
  data: { assistantResponse: string; source: Prisma.InputJsonValue | null },
): Promise<number> {
  const result = await prisma.aIChat.updateMany({
    where: { id, status: AIChatStatus.PENDING },
    data: {
      status: AIChatStatus.COMPLETED,
      assistantResponse: data.assistantResponse,
      source: data.source ?? Prisma.JsonNull,
      errorMessage: null,
    },
  });
  return result.count;
}

export async function failPendingAIChats(
  where: { id?: number; userId?: number; businessId?: number; createdBefore?: Date },
  errorMessage: string,
): Promise<number> {
  const result = await prisma.aIChat.updateMany({
    where: {
      status: AIChatStatus.PENDING,
      ...(where.id !== undefined ? { id: where.id } : {}),
      ...(where.userId !== undefined ? { userId: where.userId } : {}),
      ...(where.businessId !== undefined ? { businessId: where.businessId } : {}),
      ...(where.createdBefore ? { createdAt: { lt: where.createdBefore } } : {}),
    },
    data: { status: AIChatStatus.FAILED, errorMessage },
  });
  return result.count;
}

export interface FindAIChatsByUserParams {
  userId: number;
  businessId: number;
  limit: number;
  offset: number;
}

export async function findAIChatsByUser(
  params: FindAIChatsByUserParams,
): Promise<AIChat[]> {
  return prisma.aIChat.findMany({
    where: {
      userId: params.userId,
      businessId: params.businessId,
    },
    orderBy: { createdAt: 'desc' },
    take: params.limit,
    skip: params.offset,
  });
}

export interface CountAIChatsByUserParams {
  userId: number;
  businessId: number;
}

export async function countAIChatsByUser(
  params: CountAIChatsByUserParams,
): Promise<number> {
  return prisma.aIChat.count({
    where: {
      userId: params.userId,
      businessId: params.businessId,
    },
  });
}

export async function findAIChatById(id: number): Promise<AIChat | null> {
  return prisma.aIChat.findUnique({ where: { id } });
}

export async function deleteAIChatById(id: number): Promise<void> {
  await prisma.aIChat.delete({ where: { id } });
}

export async function deleteOldAIChatsByBusiness(businessId: number, cutoffDate: Date): Promise<number> {
  const result = await prisma.aIChat.deleteMany({
    where: { businessId, createdAt: { lt: cutoffDate } },
  });
  return result.count;
}

export async function deleteOldAIChats(cutoffDate: Date): Promise<number> {
  const result = await prisma.aIChat.deleteMany({
    where: { createdAt: { lt: cutoffDate } },
  });
  return result.count;
}
