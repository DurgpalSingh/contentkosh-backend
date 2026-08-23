import { Prisma, BusinessStatus } from '@prisma/client';
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

export interface ListBusinessesForSuperAdminParams {
  skip: number;
  take: number;
  status?: BusinessStatus | undefined;
  search?: string | undefined;
}

export async function listBusinessesForSuperAdmin({ skip, take, status, search }: ListBusinessesForSuperAdminParams) {
  const where: Prisma.BusinessWhereInput = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { instituteName: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.business.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.business.count({ where }),
  ]);

  return { items, total };
}

export interface UpdateBusinessStatusData {
  status: BusinessStatus;
  statusReason: string | null;
  statusChangedBy: number;
}

export async function updateBusinessStatus(id: number, data: UpdateBusinessStatusData) {
  return prisma.business.update({
    where: { id },
    data: {
      status: data.status,
      statusReason: data.statusReason,
      statusChangedBy: data.statusChangedBy,
      statusChangedAt: new Date(),
    },
  });
}
