import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/database';

// const prisma = new PrismaClient();

export async function createBusiness(data: Prisma.BusinessCreateInput) {
  try {
    return await prisma.business.create({
      data
    });
  } catch (error) {
    throw error;
  }
}

export async function findBusinessById(id: number) {
  return prisma.business.findUnique({
    where: { id },
  });
}

export async function findFirstBusiness() {
  return prisma.business.findFirst();
}

export async function updateBusiness(id: number, data: Prisma.BusinessUpdateInput) {
  try {
    return await prisma.business.update({
      where: { id },
      data,
    });
  } catch (error) {
    throw error;
  }
}

export async function deleteBusiness(id: number) {
  return prisma.business.delete({
    where: { id },
  });
}
