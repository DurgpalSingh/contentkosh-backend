import { Prisma, PrismaClient, UserRole } from '@prisma/client';
import { prisma } from '../config/database';

// const prisma = new PrismaClient();

const businessUserSelect = {
  id: true,
  userId: true,
  businessId: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

const userSelect = {
  id: true,
  email: true,
  name: true,
};

const businessSelect = {
  id: true,
  instituteName: true,
};


export async function createBusinessUser(data: Prisma.BusinessUserCreateInput) {
  try {
    return await prisma.businessUser.create({
      data,
      select: {
        ...businessUserSelect,
        user: { select: userSelect },
        business: { select: businessSelect }
      },
    });
  } catch (error) {
    throw error;
  }
}

export async function findBusinessUserById(id: number) {
  return prisma.businessUser.findUnique({
    where: { id },
    select: {
      ...businessUserSelect,
      user: { select: userSelect },
      business: { select: businessSelect }
    },
  });
}

export async function findBusinessUserByUserAndBusiness(userId: number, businessId: number) {
  return prisma.businessUser.findUnique({
    where: {
      userId_businessId: {
        userId,
        businessId
      }
    },
    select: {
      ...businessUserSelect,
      user: { select: userSelect },
      business: { select: businessSelect }
    },
  });
}

export async function findBusinessUsersByUserId(userId: number) {
  return prisma.businessUser.findMany({
    where: { userId },
    select: {
      ...businessUserSelect,
      business: { select: businessSelect }
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findBusinessUsersByBusinessId(businessId: number) {
  return prisma.businessUser.findMany({
    where: { businessId },
    select: {
      ...businessUserSelect,
      user: { select: userSelect },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findBusinessUsersByRole(businessId: number, role: UserRole) {
  return prisma.businessUser.findMany({
    where: {
      businessId,
      role,
      isActive: true
    },
    select: {
      ...businessUserSelect,
      user: { select: userSelect },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateBusinessUser(id: number, data: Prisma.BusinessUserUpdateInput) {
  try {
    return await prisma.businessUser.update({
      where: { id },
      data,
      select: {
        ...businessUserSelect,
        user: { select: userSelect },
        business: { select: businessSelect }
      },
    });
  } catch (error) {
    throw error;
  }
}

export async function deleteBusinessUser(id: number) {
  return prisma.businessUser.delete({
    where: { id },
  });
}
