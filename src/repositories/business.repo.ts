import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export type BusinessCreateInput = Prisma.BusinessCreateInput;
export type BusinessUpdateInput = Prisma.BusinessUpdateInput;
export async function createBusiness(data: Prisma.BusinessCreateInput) {
  return await prisma.business.create({
    data
  });
}


export async function findBusinessById(id: number) {
  return prisma.business.findFirst({
    where: {
      id,
      isDeleted: false
    },
  });
}

export async function findBusinessBySlug(slug: string) {
  return prisma.business.findFirst({
    where: {
      slug,
      isDeleted: false
    },
  });
}

export async function findFirstBusiness() {
  return prisma.business.findFirst({
    where: {
      isDeleted: false
    }
  });
}

export async function updateBusiness(id: number, data: Prisma.BusinessUpdateInput) {
  return await prisma.business.update({
    where: { id },
    data,
  });
}

export async function deleteBusiness(id: number) {
  return prisma.business.update({
    where: { id },
    data: {
      isDeleted: true
    }
  });
}
